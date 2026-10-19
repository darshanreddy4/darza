import { BadGatewayException, BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { CacheService } from "../cache/cache.service";
import { PrismaService } from "../prisma.service";
import { SettingsService } from "../store/settings.service";
import { UpdateAppearanceDto } from "./appearance.dto";
import { BASE_CURRENCY, CURRENCY_CODES, effectiveRate, inrPerUnit, parseProviderRates, parseStoredRates, rateFromInrPerUnit, selectionProblem, SUPPORTED_CURRENCIES, THEMES, type StoredRates } from "./appearance";

const HOUR = 3_600_000;
const STALE_MS = 12 * HOUR;
const RATES_URL = () => process.env.EXCHANGE_RATE_URL || `https://open.er-api.com/v6/latest/${BASE_CURRENCY}`;

@Injectable()
export class AppearanceService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("Appearance");
  private timer?: NodeJS.Timeout;

  constructor(private prisma: PrismaService, private settings: SettingsService, private cache: CacheService) {}

  onModuleInit() {
    if (process.env.DISABLE_RATE_REFRESH) return;
    // Live rates are fetched at start-up when they are missing or old, then every six hours; a failure keeps the last rates.
    void this.refreshIfStale();
    this.timer = setInterval(() => void this.refreshIfStale(), 6 * HOUR);
    this.timer.unref();
  }
  onModuleDestroy() { clearInterval(this.timer); }

  private async refreshIfStale() {
    try {
      const s = await this.settings.get();
      if (s.currencyCodes.length === 0) return;
      if (s.currencyRatesAt && Date.now() - s.currencyRatesAt.getTime() < STALE_MS) return;
      await this.refreshRates();
    } catch (e) {
      this.log.warn(`Could not refresh exchange rates: ${(e as Error).message}`);
    }
  }

  // What every page needs: the theme and the currencies shoppers may choose (with the rate for one rupee).
  publicAppearance() {
    return this.cache.wrap("appearance", {}, 30, async () => {
      const s = await this.settings.get();
      const rates = parseStoredRates(s.currencyRates);
      const options = s.currencyCodes
        .map((code) => ({ code, name: SUPPORTED_CURRENCIES.find((c) => c.code === code)?.name ?? code, rate: effectiveRate(rates, code) }))
        .filter((o): o is { code: string; name: string; rate: number } => o.rate !== null);
      const offered = options.length > 0;
      return {
        theme: s.theme,
        currency: offered
          ? { base: BASE_CURRENCY, default: s.currencyDefault === BASE_CURRENCY || options.some((o) => o.code === s.currencyDefault) ? s.currencyDefault : BASE_CURRENCY, options: [{ code: BASE_CURRENCY, name: "Indian rupee", rate: 1 }, ...options] }
          : null,
      };
    });
  }

  async adminView() {
    const s = await this.settings.get();
    const rates = parseStoredRates(s.currencyRates);
    return {
      theme: s.theme,
      themes: THEMES,
      currency: {
        codes: s.currencyCodes,
        default: s.currencyDefault,
        updatedAt: s.currencyRatesAt,
        supported: SUPPORTED_CURRENCIES.map((c) => ({
          code: c.code, name: c.name,
          liveInrPerUnit: rates.auto[c.code] ? inrPerUnit(rates.auto[c.code]) : null,
          manualInrPerUnit: rates.manual[c.code] ? inrPerUnit(rates.manual[c.code]) : null,
        })),
      },
    };
  }

  async update(dto: UpdateAppearanceDto) {
    const current = await this.settings.get();
    const codes = dto.currencyCodes ?? current.currencyCodes;
    const defaultCode = dto.currencyDefault ?? current.currencyDefault;
    const problem = selectionProblem(codes, defaultCode);
    if (problem) throw new BadRequestException(problem);

    let stored: StoredRates = parseStoredRates(current.currencyRates);
    if (dto.manualRates) {
      const manual = { ...stored.manual };
      for (const [code, value] of Object.entries(dto.manualRates)) {
        if (!CURRENCY_CODES.includes(code)) throw new BadRequestException(`${code} is not a supported currency.`);
        if (value === null) delete manual[code];
        else if (typeof value === "number" && Number.isFinite(value) && value >= 0.0001 && value <= 1_000_000) manual[code] = rateFromInrPerUnit(value);
        else throw new BadRequestException(`Enter how many rupees one ${code} is worth, for example 83.5.`);
      }
      stored = { ...stored, manual };
    }
    // An offered currency needs some rate, live or typed, or shoppers would see nothing.
    const missing = codes.filter((c) => effectiveRate(stored, c) === null);

    await this.prisma.storeSettings.update({
      where: { id: "default" },
      data: { ...(dto.theme && { theme: dto.theme }), currencyCodes: codes, currencyDefault: defaultCode, currencyRates: stored as object },
    });
    await this.cache.invalidate();
    // Newly offered currencies get their live rate straight away.
    if (missing.length) await this.refreshRates().catch((e) => this.log.warn(`Could not fetch rates for ${missing.join(", ")}: ${(e as Error).message}`));
    return this.adminView();
  }

  // Fetches today's rates from the exchange-rate service (any provider answering { rates: { USD: ... } } for one rupee).
  async refreshRates() {
    let body: unknown;
    try {
      const res = await fetch(RATES_URL(), { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`the rate service answered ${res.status}`);
      body = await res.json();
    } catch (e) {
      const code = String(((e as { cause?: { code?: string } }).cause)?.code ?? "");
      const tls = /CERT|SSL|TLS/.test(code);
      const why = tls ? `a network or company firewall is replacing the secure certificate (${code}). Start the API with NODE_EXTRA_CA_CERTS pointing to your company's certificate file` : code || (e as Error).message;
      throw new BadGatewayException(`Could not get today's exchange rates (${why}). The last rates stay in use; you can type a rate by hand.`);
    }
    const auto = parseProviderRates(body);
    if (!auto) throw new BadGatewayException("The exchange-rate service sent an answer we could not read. The last rates stay in use.");
    const current = await this.settings.get();
    const stored = parseStoredRates(current.currencyRates);
    await this.prisma.storeSettings.update({ where: { id: "default" }, data: { currencyRates: { ...stored, auto } as object, currencyRatesAt: new Date() } });
    await this.cache.invalidate();
    return this.adminView();
  }
}
