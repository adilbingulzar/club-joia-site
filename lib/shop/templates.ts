/*
 * The buyer emails in the Club JOIA 300 design:
 *   confirmed  "Your payment is confirmed", after payment
 *   failed     "One more step to join us", after a declined or cancelled payment
 * and the pre-registration page's (lib/preregister.ts), in the same design:
 *   preregisterGuest  "Your CLUB JOIA 300 pre-registration", to the guest
 *   preregisterTeam   "New / Repeat pre-registration: <name>", every detail, to PREREG_NOTIFY_EMAIL
 * Each is { subject, html, text }. Images from this site's /shop/email (public/shop/email).
 */
import { shopConfig as config } from './config';

export type Mail = { subject: string; html: string; text: string };
export type MailItem = { quantity: number; name: string };
export type MailOrder = { eventName: string; eventStart?: string; eventEnd?: string; items: MailItem[]; phone: string };

export function esc(s: unknown): string {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// "4–6 December 2026" for an event of YYYY-MM-DD dates
export function eventDates(start?: string, end?: string): string {
  const s = String(start || '').split('-').map(Number);
  const e = String(end || start || '').split('-').map(Number);
  if (s.length !== 3 || e.length !== 3) return '';
  if (s.join() === e.join()) return s[2] + ' ' + MONTHS[s[1] - 1] + ' ' + s[0];
  if (s[0] === e[0] && s[1] === e[1]) return s[2] + '–' + e[2] + ' ' + MONTHS[e[1] - 1] + ' ' + e[0];
  if (s[0] === e[0]) return s[2] + ' ' + MONTHS[s[1] - 1] + ' – ' + e[2] + ' ' + MONTHS[e[1] - 1] + ' ' + e[0];
  return s[2] + ' ' + MONTHS[s[1] - 1] + ' ' + s[0] + ' – ' + e[2] + ' ' + MONTHS[e[1] - 1] + ' ' + e[0];
}

function ticketLines(items: MailItem[]): string[] {
  return items.map(function (i) { return i.quantity + ' × ' + i.name; });
}

function image(name: string): string {
  // this site's public/shop/email
  return config.publicUrl + '/shop/email/' + name;
}

const P = 'margin:0 0 18px;font-size:16px;line-height:27px;color:#ffffff;';

function button(href: string, label: string): string {
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px;"><tr>' +
    '<td bgcolor="#ffffff" style="border-radius:99px;"><a href="' + esc(href) + '" style="display:inline-block;padding:15px 32px;font-size:16px;line-height:20px;font-weight:600;color:#000000;text-decoration:none;border-radius:99px;">' + esc(label) + '</a></td>' +
    '</tr></table>';
}

// label / value rows between two lines; values are HTML already
function rows(list: [string, string][]): string {
  const row = function (label: string, value: string, pad: string) {
    return '<tr><td class="label" style="padding:' + pad + ';font-size:15px;line-height:22px;color:#a6a6a6;vertical-align:top;">' + esc(label) + '</td>' +
      '<td class="value" align="right" style="padding:' + pad + ';font-size:15px;line-height:22px;color:#ffffff;text-align:right;">' + value + '</td></tr>';
  };
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #2c2c2c;border-bottom:1px solid #2c2c2c;margin:0 0 28px;">' +
    list.map(function (r, i) { return row(r[0], r[1], (i ? '12px' : '18px') + ' 0 ' + (i === list.length - 1 ? '18px' : '12px')); }).join('') +
    '</table>';
}

// the event / date / ticket rows
function facts(o: MailOrder): string {
  return rows([
    ['Event', esc(o.eventName)],
    ['Date', esc(eventDates(o.eventStart, o.eventEnd))],
    ['Arrangement / Ticket', ticketLines(o.items).map(esc).join('<br>')]
  ]);
}

function assistance(phone: string): string {
  return phone
    ? '<p style="' + P + 'margin-bottom:32px;">For assistance, please call us on <strong>' + esc(phone) + '</strong>.</p>'
    : '<p style="' + P + 'margin-bottom:32px;">For assistance, please contact us through <a href="https://clubjoia300.com" style="color:#ffffff;">clubjoia300.com</a>.</p>';
}

// closing: the "We look forward to welcoming you" and "Warm regards" lines (not in the team's email)
function layout(title: string, body: string, phone: string, closing = true): string {
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + esc(title) + '</title>\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@800&family=Outfit:wght@400;600&display=swap" rel="stylesheet">\n' +
    '<style>\n  @media (max-width: 620px) {\n    .pad { padding-left: 24px !important; padding-right: 24px !important; }\n' +
    '    .title { font-size: 26px !important; line-height: 34px !important; }\n' +
    '    .label, .value { display: block !important; width: 100% !important; text-align: left !important; }\n' +
    '    .label { padding-bottom: 2px !important; }\n    .value { padding-top: 0 !important; }\n  }\n</style>\n</head>\n' +
    '<body style="margin:0;padding:0;background-color:#151515;">\n' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#151515" style="background-color:#151515;"><tr><td align="center">\n' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#050505" style="width:100%;max-width:600px;background-color:#050505;font-family:\'Outfit\',\'Helvetica Neue\',Arial,sans-serif;color:#ffffff;">\n' +
    '<tr><td class="pad" style="padding:32px 40px 28px;"><img src="' + esc(image('logo.png')) + '" width="224" alt="Club JOIA 300" style="display:block;width:224px;max-width:100%;height:auto;border:0;"></td></tr>\n' +
    '<tr><td style="padding:0;line-height:0;"><img src="' + esc(image('hero.jpg')) + '" width="600" alt="Club JOIA 300 yacht beside the Abu Dhabi Grand Prix track at sunset" style="display:block;width:100%;height:auto;border:0;"></td></tr>\n' +
    '<tr><td class="pad" style="padding:56px 40px 48px;">\n' +
    '<p style="margin:0 0 22px;font-size:12px;line-height:18px;letter-spacing:3px;color:#b6b6b6;text-transform:uppercase;">Abu Dhabi Grand Prix &middot; Club JOIA 300</p>\n' +
    '<h1 class="title" style="margin:0 0 30px;font-family:\'Orbitron\',\'Arial Black\',Arial,sans-serif;font-size:30px;line-height:38px;font-weight:800;color:#ffffff;">' + esc(title) + '</h1>\n' +
    body +
    (closing
      ? '<p style="' + P + 'margin-bottom:32px;">We look forward to welcoming you.</p>\n' +
        '<p style="margin:0;font-size:16px;line-height:27px;color:#ffffff;">Warm regards,<br><strong>The Club JOIA 300 Team</strong></p>\n'
      : '') +
    '</td></tr>\n' +
    '<tr><td class="pad" style="padding:32px 40px 32px;border-top:1px solid #2c2c2c;">' +
    '<img src="' + esc(image('logo.png')) + '" width="150" alt="Club JOIA 300" style="display:block;width:150px;height:auto;border:0;margin:0 0 18px;">' +
    '<p style="margin:0 0 18px;font-size:13px;line-height:22px;color:#a6a6a6;">An exclusive trackside yacht experience.<br>Yas Marina Circuit, Abu Dhabi</p>' +
    '<p style="margin:0;font-size:13px;line-height:20px;color:#a6a6a6;"><a href="https://clubjoia300.com" style="color:#ffffff;text-decoration:underline;">clubjoia300.com</a>' + (phone ? ' &middot; ' + esc(phone) : '') + '</p>' +
    '</td></tr>\n</table>\n</td></tr></table>\n</body>\n</html>\n';
}

function textFacts(o: MailOrder): string {
  return 'Event: ' + o.eventName + '\nDate: ' + eventDates(o.eventStart, o.eventEnd) + '\nArrangement / Ticket: ' + ticketLines(o.items).join('; ') + '\n\n';
}

function textEnd(phone: string): string {
  return (phone ? 'For assistance, please call us on ' + phone + '.' : 'For assistance, please contact us through clubjoia300.com.') +
    '\n\nWe look forward to welcoming you.\n\nWarm regards,\nThe Club JOIA 300 Team\nclubjoia300.com';
}

export function confirmed(o: MailOrder): Mail {
  const title = 'Your payment is confirmed';
  const body =
    '<p style="' + P + '">Dear Member,</p>\n' +
    '<p style="' + P + 'margin-bottom:26px;">Thank you for your payment. We look forward to welcoming you to an exclusive trackside yacht experience at the Abu Dhabi Grand Prix.</p>\n' +
    facts(o) +
    '<p style="' + P + '">You will receive your personalised entry ticket and arrival instructions by email within <strong>3 working days</strong>.</p>\n' +
    assistance(o.phone);
  return {
    subject: 'Your payment is confirmed – Club JOIA 300',
    html: layout(title, body, o.phone),
    text: 'Dear Member,\n\nThank you for your payment. We look forward to welcoming you to an exclusive trackside yacht experience at the Abu Dhabi Grand Prix.\n\n' +
      textFacts(o) + 'You will receive your personalised entry ticket and arrival instructions by email within 3 working days.\n\n' + textEnd(o.phone)
  };
}

export function failed(o: MailOrder & { payUrl: string; altUrl: string }): Mail {
  const title = 'One more step to join us';
  const body =
    '<p style="' + P + '">Dear Member,</p>\n' +
    '<p style="' + P + 'margin-bottom:26px;">Unfortunately, we were unable to process your payment. Please try again using one of the payment options below.</p>\n' +
    facts(o) +
    button(o.payUrl, 'Complete your payment') +
    '<p style="margin:0 0 22px;font-size:16px;line-height:27px;"><a href="' + esc(o.altUrl) + '" style="color:#ffffff;text-decoration:underline;">Alternative payment option &rarr;</a></p>\n' +
    '<p style="' + P + '">Once your payment is confirmed, you will receive your personalised entry ticket and arrival instructions by email within <strong>3 working days</strong>.</p>\n' +
    assistance(o.phone);
  return {
    subject: 'One more step to join us – Club JOIA 300',
    html: layout(title, body, o.phone),
    text: 'Dear Member,\n\nUnfortunately, we were unable to process your payment. Please try again using one of the payment options below.\n\n' +
      textFacts(o) + 'Complete your payment: ' + o.payUrl + '\nAlternative payment option: ' + o.altUrl + '\n\n' +
      'Once your payment is confirmed, you will receive your personalised entry ticket and arrival instructions by email within 3 working days.\n\n' + textEnd(o.phone)
  };
}

// ─── The pre-registration page ───

export type PreRegistration = {
  firstName: string; lastName: string; email: string; phone: string; country: string;
  tier: string; source: string; message: string; marketing: boolean; consentAt: string;
};

export function preregisterGuest(r: PreRegistration, phone: string): Mail {
  const title = 'Thank you for pre-registering';
  const body =
    '<p style="' + P + '">Dear ' + esc(r.firstName) + ',</p>\n' +
    '<p style="' + P + '">Thank you for pre-registering for Club JOIA 300.</p>\n' +
    '<p style="' + P + 'margin-bottom:26px;">Membership is limited to 300 members and is by invitation only. Our team will review your pre-registration and contact you personally.</p>\n' +
    rows([['Name', esc(r.firstName + ' ' + r.lastName)], ['Membership interest', esc(r.tier)]]) +
    assistance(phone);
  return {
    subject: 'Your CLUB JOIA 300 pre-registration',
    html: layout(title, body, phone),
    text: 'Dear ' + r.firstName + ',\n\nThank you for pre-registering for Club JOIA 300.\n\n' +
      'Membership is limited to 300 members and is by invitation only. Our team will review your pre-registration and contact you personally.\n\n' +
      'Name: ' + r.firstName + ' ' + r.lastName + '\nMembership interest: ' + r.tier + '\n\n' + textEnd(phone)
  };
}

export function preregisterTeam(r: PreRegistration, again: boolean, phone: string): Mail {
  const name = r.firstName + ' ' + r.lastName;
  const details: [string, string][] = [
    ['Name', esc(name)],
    ['Email', '<a href="mailto:' + esc(r.email) + '" style="color:#ffffff;">' + esc(r.email) + '</a>'],
    ['Mobile', esc(r.phone)],
    ['Country', esc(r.country)],
    ['Membership interest', esc(r.tier)],
    ['Heard about us', esc(r.source || '–')],
    ['Marketing emails', r.marketing ? 'Yes' : 'No'],
    ['Consent to be contacted', 'Yes, ' + esc(r.consentAt)]
  ];
  const title = (again ? 'Repeat' : 'New') + ' pre-registration';
  const body =
    '<p style="' + P + 'margin-bottom:26px;">' + (again
      ? esc(name) + ' has pre-registered again with this email; the earlier submissions are kept too.'
      : esc(name) + ' has pre-registered on clubjoia300.com.') + '</p>\n' +
    rows(details) +
    '<p style="margin:0 0 8px;font-size:15px;line-height:22px;color:#a6a6a6;">Message</p>\n' +
    '<p style="' + P + 'margin-bottom:0;white-space:pre-wrap;">' + (r.message ? esc(r.message).replace(/\n/g, '<br>') : '–') + '</p>\n';
  return {
    subject: title + ': ' + name,
    html: layout(title, body, phone, false),
    text: (again ? name + ' has pre-registered again with this email; the earlier submissions are kept too.' : name + ' has pre-registered on clubjoia300.com.') + '\n\n' +
      details.map(function (d, i) { return d[0] + ': ' + [name, r.email, r.phone, r.country, r.tier, r.source || '–', r.marketing ? 'Yes' : 'No', 'Yes, ' + r.consentAt][i]; }).join('\n') +
      '\n\nMessage:\n' + (r.message || '–') + '\n'
  };
}
