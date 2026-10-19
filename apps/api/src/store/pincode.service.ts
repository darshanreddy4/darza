import { BadRequestException, Controller, Get, Injectable, Param } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CacheService } from "../cache/cache.service";
import { PINCODE_FORMAT, parsePostOfficeAnswer, prefixInfo, type PincodeResult } from "./pincode";

const MONTH = 30 * 24 * 3600;
const SOURCE = process.env.PINCODE_API_URL ?? "https://api.postalpincode.in/pincode";

type Fetcher = (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean; status?: number; json(): Promise<unknown> }>;

@Injectable()
export class PincodeService {
  // Replaced in tests.
  fetcher: Fetcher = fetch as unknown as Fetcher;

  constructor(private cache: CacheService) {}

  // Checks a PIN code: its shape, whether India Post uses it, and the place it belongs to. When the lookup service cannot be reached the first digits are checked instead, so an address is never refused because of an outage.
  async lookup(pin: string): Promise<PincodeResult> {
    const info = prefixInfo(pin);
    if (!PINCODE_FORMAT.test(pin)) return { pincode: pin, valid: false, reason: "format", states: [] };
    if (!info.known) return { pincode: pin, valid: false, reason: "unknown", states: [] };
    const regional: PincodeResult = { pincode: pin, valid: true, states: info.states, state: info.states.length === 1 ? info.states[0] : undefined, source: "region" };
    if (process.env.PINCODE_LOOKUP === "off" || info.army) return regional;
    try {
      return await this.cache.wrap("pincode", { pin }, MONTH, () => this.ask(pin));
    } catch {
      return regional;
    }
  }

  // Throws when the PIN code does not exist.
  async assertValid(pin: string) {
    const r = await this.lookup(pin);
    if (!r.valid) throw new BadRequestException(r.reason === "format" ? "Enter a valid 6-digit PIN code." : `We couldn't find PIN code ${pin}. Please check it.`);
  }

  private async ask(pin: string): Promise<PincodeResult> {
    const res = await this.fetcher(`${SOURCE}/${pin}`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) throw new Error(`lookup answered ${res.status}`);
    const answer = parsePostOfficeAnswer(await res.json());
    if (!answer) throw new Error("lookup answer not understood");
    if (!answer.found) return { pincode: pin, valid: false, reason: "unknown", states: [] };
    return { pincode: pin, valid: true, city: answer.city, district: answer.district, state: answer.state, states: [answer.state], areas: answer.areas, source: "post-office" };
  }
}

@Controller("pincode")
export class PincodeController {
  constructor(private pincodes: PincodeService) {}

  @Get(":pin")
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  lookup(@Param("pin") pin: string) {
    return this.pincodes.lookup(pin.slice(0, 12));
  }
}
