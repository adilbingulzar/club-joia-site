/*
 * The emails (templates.ts) from EMAIL_FROM, through EMAIL_DRIVER:
 *   postmark  Postmark's API (POSTMARK_SERVER_TOKEN, POSTMARK_MESSAGE_STREAM, default "outbound")
 *   smtp      an SMTP server (SMTP_URL)
 *   anything else only writes them to the log.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { ServerClient } from 'postmark';
import { shopConfig as config } from './config';
import { confirmed, failed, type Mail, type MailOrder } from './templates';

let transport: Transporter | null = null;
let postmark: { token: string; client: ServerClient } | null = null;

function postmarkClient(): ServerClient {
  const token = config.email.postmarkToken;
  if (!postmark || postmark.token !== token) postmark = { token, client: new ServerClient(token) };
  return postmark.client;
}

// true when delivered
export async function send(to: string, mail: Mail): Promise<boolean> {
  try {
    if (config.email.driver === 'postmark' && config.email.postmarkToken) {
      const r = await postmarkClient().sendEmail({
        From: config.email.from, To: to, Subject: mail.subject, TextBody: mail.text, HtmlBody: mail.html,
        MessageStream: config.email.postmarkStream
      });
      console.info('[shop] email "' + mail.subject + '" sent to ' + to + ' (Postmark ' + r.MessageID + ')');
      return true;
    }
    if (config.email.driver === 'smtp' && config.email.smtpUrl) {
      if (!transport) transport = nodemailer.createTransport(config.email.smtpUrl);
      await transport.sendMail({ from: config.email.from, to, subject: mail.subject, text: mail.text, html: mail.html });
      console.info('[shop] email "' + mail.subject + '" sent to ' + to);
      return true;
    }
    console.info('\n[shop email:console] (not delivered, EMAIL_DRIVER is ' + config.email.driver + ')\nFrom: ' + config.email.from + '\nTo: ' + to + '\nSubject: ' + mail.subject + '\n\n' + mail.text + '\n');
    return false;
  } catch (e) {
    console.error('[shop] email "' + mail.subject + '" to ' + to + ' failed:', (e as Error).message);
    return false;
  }
}

// after payment: "Your payment is confirmed"
export function paidEmail(to: string, o: MailOrder): Promise<boolean> {
  return send(to, confirmed(o));
}

// after a declined or cancelled payment: "One more step to join us"
export function notPaidEmail(to: string, o: MailOrder & { payUrl: string; altUrl: string }): Promise<boolean> {
  return send(to, failed(o));
}
