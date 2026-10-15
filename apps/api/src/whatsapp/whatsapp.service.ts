import { Global, Injectable, Logger, Module } from "@nestjs/common";
import type { OrderMailKind } from "../mail/order-mail";
import { normalisePhone } from "../auth/phone";
import { orderUpdateSentence, templateParams, whatsAppNumber, type WhatsAppOrderData } from "./whatsapp-message";

// Order updates through the WhatsApp Business Cloud API. Needs WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID, plus a message template
// approved in Meta Business Manager (WHATSAPP_TEMPLATE, default "order_update") with four body variables: name, order, update, link.
// Without them, development prints the message in the API log and production simply does not offer the option.
@Injectable()
export class WhatsAppService {
  private readonly log = new Logger("WhatsApp");
  private readonly token = process.env.WHATSAPP_TOKEN;
  private readonly phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  private readonly template = process.env.WHATSAPP_TEMPLATE || "order_update";
  private readonly language = process.env.WHATSAPP_TEMPLATE_LANG || "en";

  get configured() {
    return !!(this.token && this.phoneId);
  }

  // Customers are offered WhatsApp updates only when they would really be sent (or logged in development).
  get available() {
    return this.configured || process.env.NODE_ENV !== "production";
  }

  // Never throws: a WhatsApp outage must not affect an order.
  async sendOrderUpdate(phone: string, kind: OrderMailKind, data: WhatsAppOrderData): Promise<boolean> {
    const e164 = normalisePhone(phone);
    if (!e164) return false;
    if (!this.configured) {
      this.log.log(`WhatsApp not sent (not configured)\nTo: ${e164}\nHi ${data.name}, ${data.orderRef}: ${orderUpdateSentence(kind, data)} ${data.url}`);
      return process.env.NODE_ENV !== "production";
    }
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${this.phoneId}/messages`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp", to: whatsAppNumber(e164), type: "template",
          template: { name: this.template, language: { code: this.language }, components: [{ type: "body", parameters: templateParams(kind, data).map((text) => ({ type: "text", text })) }] },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) this.log.error(`WhatsApp refused the message (${res.status}): ${(await res.text()).slice(0, 200)}`);
      return res.ok;
    } catch (e) {
      this.log.error(`Could not send a WhatsApp message: ${(e as Error).message}`);
      return false;
    }
  }
}

@Global()
@Module({ providers: [WhatsAppService], exports: [WhatsAppService] })
export class WhatsAppModule {}
