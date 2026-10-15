import { API_URL } from "@/lib/api";

export interface PaymentParams { orderId: string; keyId: string; razorpayOrderId: string; amountPaise: number; currency: "INR" }

interface RazorpaySuccess { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
interface RazorpayInstance { open(): void; on(event: "payment.failed", cb: (r: { error?: { description?: string } }) => void): void }
declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance }
}

function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the payment window. Check your connection and try again."));
    document.body.appendChild(s);
  });
}

export type PayResult = { status: "paid" } | { status: "dismissed" } | { status: "failed"; message: string };

// Opens Razorpay Checkout, then asks our API to verify the signed result before the order is marked paid.
export async function payForOrder(params: PaymentParams, prefill: { name: string; email?: string | null; phone?: string | null }, brand: string): Promise<PayResult> {
  await loadScript();
  return new Promise<PayResult>((resolve) => {
    const rzp = new window.Razorpay!({
      key: params.keyId,
      order_id: params.razorpayOrderId,
      amount: params.amountPaise,
      currency: params.currency,
      name: brand,
      description: "Order payment",
      prefill: { name: prefill.name, email: prefill.email ?? undefined, contact: prefill.phone ?? undefined },
      theme: { color: "#0b1220" },
      modal: { ondismiss: () => resolve({ status: "dismissed" }) },
      handler: async (r: RazorpaySuccess) => {
        try {
          const res = await fetch(`${API_URL}/orders/${params.orderId}/verify`, {
            method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(r),
          });
          resolve(res.ok ? { status: "paid" } : { status: "failed", message: "We could not verify your payment. If money was deducted it will be reconciled shortly." });
        } catch {
          resolve({ status: "failed", message: "Could not reach the server to confirm your payment. Please check My orders." });
        }
      },
    });
    rzp.on("payment.failed", (r) => resolve({ status: "failed", message: r.error?.description ?? "Payment failed. You can try again from My orders." }));
    rzp.open();
  });
}
