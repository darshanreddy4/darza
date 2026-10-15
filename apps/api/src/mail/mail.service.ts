import { Global, Injectable, Logger, Module } from "@nestjs/common";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { createTransport, type Transporter } from "nodemailer";
import { buildRawEmail, type MailAttachment } from "./mime";

export interface Mail { to: string; subject: string; text: string; html: string; attachments?: MailAttachment[] }

@Injectable()
export class MailService {
  private readonly log = new Logger("Mail");
  private readonly from = process.env.MAIL_FROM;
  // Mail goes out through SMTP (SMTP_URL, any provider) or Amazon SES (AWS_REGION); with neither, development prints it in the API log.
  private readonly smtp: Transporter | null = this.from && process.env.SMTP_URL ? createTransport(process.env.SMTP_URL) : null;
  private readonly ses = !this.smtp && this.from && process.env.AWS_REGION ? new SESv2Client({ region: process.env.AWS_REGION }) : null;

  // Never throws: a mail outage must not break sign-up or reveal whether an address exists.
  // Returns whether the message was handed over (or, in development, logged).
  async send(mail: Mail): Promise<boolean> {
    if (!this.ses && !this.smtp) {
      this.log.log(`Email not sent (no mail provider configured)\nTo: ${mail.to}\nSubject: ${mail.subject}${mail.attachments?.length ? `\nAttachments: ${mail.attachments.map((a) => a.filename).join(", ")}` : ""}\n\n${mail.text}`);
      return process.env.NODE_ENV !== "production";
    }
    try {
      if (this.smtp) {
        await this.smtp.sendMail({ from: this.from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html, attachments: mail.attachments?.map((a) => ({ filename: a.filename, contentType: a.contentType, content: a.content })) });
        return true;
      }
      await this.ses!.send(new SendEmailCommand({
        FromEmailAddress: this.from,
        Destination: { ToAddresses: [mail.to] },
        Content: mail.attachments?.length
          ? { Raw: { Data: Buffer.from(buildRawEmail({ from: this.from!, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html, attachments: mail.attachments })) } }
          : { Simple: { Subject: { Data: mail.subject }, Body: { Text: { Data: mail.text }, Html: { Data: mail.html } } } },
      }));
      return true;
    } catch (err) {
      this.log.error(`Failed to send "${mail.subject}": ${(err as Error).message}`);
      return false;
    }
  }
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
