import { BadGatewayException, Injectable, Logger } from "@nestjs/common";

export interface RazorpayOrder { id: string; amount: number; currency: string; status: string }
export interface RazorpayRefund { id: string; amount: number; status: string }

// Thin wrapper over Razorpay's REST API; online payments are enabled only when keys are configured.
@Injectable()
export class RazorpayService {
  private readonly log = new Logger(RazorpayService.name);

  get keyId() { return process.env.RAZORPAY_KEY_ID ?? ""; }
  get keySecret() { return process.env.RAZORPAY_KEY_SECRET ?? ""; }
  get webhookSecret() { return process.env.RAZORPAY_WEBHOOK_SECRET ?? ""; }
  get enabled() { return !!this.keyId && !!this.keySecret; }
  // Only the tests change this, to point at a stand-in server.
  private get apiUrl() { return process.env.RAZORPAY_API_URL || "https://api.razorpay.com/v1"; }

  createOrder(amountPaise: number, receipt: string): Promise<RazorpayOrder> {
    return this.post<RazorpayOrder>("/orders", { amount: amountPaise, currency: "INR", receipt }, "Could not start the online payment. Please try again or choose pay on delivery.");
  }

  // Sends the money back to the customer's original payment method.
  refund(paymentId: string, amountPaise: number, orderId: string): Promise<RazorpayRefund> {
    return this.post<RazorpayRefund>(`/payments/${encodeURIComponent(paymentId)}/refund`, { amount: amountPaise, speed: "normal", notes: { orderId } }, "Razorpay could not process the refund");
  }

  private async post<T>(path: string, body: unknown, failure: string): Promise<T> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
    try {
      const res = await fetch(`${this.apiUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Basic ${auth}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        this.log.error(`Razorpay ${path} failed: ${res.status} ${text}`);
        let detail = "";
        try { detail = JSON.parse(text)?.error?.description ?? ""; } catch { /* not JSON */ }
        throw new BadGatewayException(detail ? `${failure}: ${detail}` : failure);
      }
      return (await res.json()) as T;
    } catch (e) {
      if (e instanceof BadGatewayException) throw e;
      this.log.error(`Razorpay request error: ${(e as Error).message}`);
      throw new BadGatewayException("Payment service is unreachable. Please try again in a moment.");
    }
  }
}
