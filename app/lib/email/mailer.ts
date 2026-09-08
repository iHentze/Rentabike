/**
 * Outbound mail. One interface, two implementations: the Cloudflare Email
 * Service binding in production, and a console logger everywhere the binding
 * is missing — local dev, tests, and a production deploy before the sending
 * domain is onboarded. A missing binding must never break a booking: the
 * booking is the record, the email is a courtesy copy of it.
 */

export interface MailAttachment {
  filename: string;
  type: string;
  /** Text content; encoded to base64 for the binding. */
  content: string;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: MailAttachment[];
}

export interface Mailer {
  send(mail: Mail): Promise<{ id: string | null }>;
}

/** The `send_email` binding as `wrangler types` declares it (global `SendEmail`). */
export type EmailBinding = Pick<SendEmail, "send">;

export interface MailerEnv {
  EMAIL?: EmailBinding;
  /** "Rent a Bike & Outdoor <booking@rentabike.fo>" — must be a sender on the onboarded domain. */
  EMAIL_FROM?: string;
  EMAIL_REPLY_TO?: string;
}

export const DEFAULT_FROM = { email: "booking@rentabike.fo", name: "Rent a Bike & Outdoor" };
export const DEFAULT_REPLY_TO = { email: "rentabike@rentabike.fo", name: "Rent a Bike & Outdoor" };

/** "Name <addr>" or "addr" → { email, name }. */
export function parseAddress(s: string | undefined, fallback: { email: string; name?: string }): { email: string; name?: string } {
  if (!s) return fallback;
  const m = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(s);
  if (m) return { email: m[2]!.trim(), name: m[1]?.trim() || undefined };
  return { email: s.trim() };
}

export function mailerFor(env: MailerEnv): Mailer {
  if (env.EMAIL) return new CloudflareMailer(env.EMAIL, parseAddress(env.EMAIL_FROM, DEFAULT_FROM), parseAddress(env.EMAIL_REPLY_TO, DEFAULT_REPLY_TO));
  return new ConsoleMailer();
}

export class CloudflareMailer implements Mailer {
  constructor(
    private readonly binding: EmailBinding,
    private readonly from: { email: string; name?: string },
    private readonly replyTo: { email: string; name?: string },
  ) {}

  async send(mail: Mail): Promise<{ id: string | null }> {
    const addr = (a: { email: string; name?: string }): string | EmailAddress => (a.name ? { email: a.email, name: a.name } : a.email);
    const message: EmailMessageBuilder = {
      to: mail.to,
      from: addr(this.from),
      replyTo: addr(this.replyTo),
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments: mail.attachments?.map((a) => ({ content: toBase64(a.content), filename: a.filename, type: a.type, disposition: "attachment" as const })),
    };
    const res = await this.binding.send(message);
    return { id: res.messageId };
  }
}

/** No binding: say what would have gone out, loudly enough to notice in the logs. */
export class ConsoleMailer implements Mailer {
  readonly sent: Mail[] = [];
  async send(mail: Mail): Promise<{ id: string | null }> {
    this.sent.push(mail);
    console.log(`[email not sent — no EMAIL binding] to=${mail.to} subject=${JSON.stringify(mail.subject)}`);
    return { id: null };
  }
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
