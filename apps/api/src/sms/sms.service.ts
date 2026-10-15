import { Global, Injectable, Logger, Module } from "@nestjs/common";

// Sends text messages through Twilio when TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM are set.
// Without them, development prints the message in the API log (like email) and production offers no phone sign-in.
@Injectable()
export class SmsService {
  private readonly log = new Logger("Sms");
  private readonly sid = process.env.TWILIO_ACCOUNT_SID;
  private readonly token = process.env.TWILIO_AUTH_TOKEN;
  private readonly from = process.env.TWILIO_FROM;

  get configured() {
    return !!(this.sid && this.token && this.from);
  }

  // Phone sign-in is offered when messages can really be sent, or in development where they are logged.
  get available() {
    return this.configured || process.env.NODE_ENV !== "production";
  }

  // Never throws: a failed text must not reveal whether a number has an account.
  async send(to: string, body: string): Promise<boolean> {
    if (!this.configured) {
      this.log.log(`SMS not sent (Twilio not configured)\nTo: ${to}\n${body}`);
      return process.env.NODE_ENV !== "production";
    }
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`, {
        method: "POST",
        headers: { authorization: `Basic ${Buffer.from(`${this.sid}:${this.token}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: to, From: this.from!, Body: body }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) this.log.error(`Twilio refused the message (${res.status}): ${(await res.text()).slice(0, 200)}`);
      return res.ok;
    } catch (e) {
      this.log.error(`Could not send an SMS: ${(e as Error).message}`);
      return false;
    }
  }
}

@Global()
@Module({ providers: [SmsService], exports: [SmsService] })
export class SmsModule {}
