import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 10;
const seen = new Map<string, number>();

// The same error is reported at most once per window, and at most MAX_PER_WINDOW different ones, so an outage cannot flood the channel.
export function shouldReport(key: string, now = Date.now(), store = seen): boolean {
  for (const [k, t] of store) if (now - t > WINDOW_MS) store.delete(k);
  if (store.has(key) || store.size >= MAX_PER_WINDOW) return false;
  store.set(key, now);
  return true;
}

// Unexpected (5xx) errors are logged with the request that caused them and, when ERROR_WEBHOOK_URL is set, posted there as
// JSON ({ text, ... }); that fits Slack, Discord or any alerting tool that takes a webhook with a text field.
@Catch()
export class ErrorReporter extends BaseExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger("Errors");

  catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (status >= 500) {
      const req = host.switchToHttp().getRequest<{ method?: string; url?: string }>();
      const message = exception instanceof Error ? exception.message : String(exception);
      this.log.error(`${req?.method ?? "?"} ${req?.url?.split("?")[0] ?? "?"} failed: ${message}`, exception instanceof Error ? exception.stack : undefined);
      const url = process.env.ERROR_WEBHOOK_URL;
      if (url && shouldReport(`${req?.method} ${req?.url?.split("?")[0]} ${message}`)) {
        const text = `${process.env.SITE_NAME ?? "Store"} API error: ${req?.method} ${req?.url?.split("?")[0]}: ${message}`.slice(0, 1500);
        void fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, content: text }), signal: AbortSignal.timeout(5000) }).catch(() => {});
      }
    }
    super.catch(exception, host);
  }
}
