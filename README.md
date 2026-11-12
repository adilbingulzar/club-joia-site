# Club JOIA 300

Next.js version of the Club JOIA 300 ticket site (clubjoia300.com). Design and booking flow are identical to the original static site; tickets are sold by the site's own ticket shop (`lib/shop`) and paid by card through IFZA (its gateway is Telr).

## Run

```bash
npm install
npm run dev      # development, http://localhost:3000
npm run build && npm start   # production
npm test         # tests (tests/, Vitest); the shop's functions are faked by tests/shop-mock.ts
SHOP_TEST_DATABASE_URL=mysql://... npm test   # also the ticket shop on a local database (tests/shop.test.ts)
# as the site's limited user: SHOP_TEST_DATABASE_URL=mysql://club_site:... SHOP_TEST_ADMIN_DATABASE_URL=mysql://root:... npm test
# (in these test addresses a @ in a password is written %40)
```

The ticket shop needs the members app's MySQL database (MySQL 8.0.19 or newer), on the same server
as the site. Its settings are in `.env` (not committed, see `.gitignore`):

```bash
DB_HOST="127.0.0.1"   # not "localhost": Node may try IPv6 (::1) for it
DB_PORT="3306"
DB_USER="..."
DB_PASSWORD="..."
DB_NAME="joia_dev"
```

Locally that's `joia_dev` on this machine's MySQL.

## Where things live

- `lib/config.ts` — access levels, day packages, benefits, sold-out flags and payment settings. Its prices and currency are only used while the shop can't be reached.
- `lib/catalog.ts` — prices, currency and sold out from the ticket shop (`ticketTypes`, `soldOut`, `events` of `lib/shop/orders.ts`), for the event `SHOP_EVENT`. Pages get the last answer at once and a newer one is fetched behind it after a minute; prices show a shimmering bar until it has answered (`components/Price.tsx` on server pages, `lib/prices.tsx` for client components) and "Price unavailable" when it can't be reached.
- `lib/cart.ts` — the cart, kept in `sessionStorage` (key `cj300-cart`) so it survives page changes.
- `app/globals.css` — the original `main.css`, unchanged except that `-webkit-backdrop-filter` is declared before `backdrop-filter` (the CSS minifier drops the standard one otherwise).
- `app/` — one folder per page: `/`, `/ruby-red`, `/pearly-white`, `/ultra-black`, `/tickets`, `/summary`, `/thank-you`, `/payment/[status]`, plus `not-found.tsx`.
- `lib/shop/`, `app/Api/`, `app/shop/` — the ticket shop, see below.
- `public/assets/` — images; `public/shop/email/` — the buyer emails' images.

Old addresses such as `/tickets.html` or `/thank-you.html` redirect permanently to the new ones (see `next.config.ts`), so shared links and payment success URLs keep working.

## Ticket shop (IFZA payments)

The site sells the tickets itself, in **USD**, paid by card through **IFZA's payment API** (IFZA's
gateway is Telr, with 3-D Secure), and writes the buyer as a member with the tickets into the
members app's MySQL database (`club-joia-300-backend`, whose code isn't used: only its database).
Alfred is no longer used, nor a direct Telr store. The site's pages call the shop's functions
directly (`lib/shop`), not over HTTP.

1. `/summary`: the buyer fills in their details. `app/api/checkout/route.ts` checks the form and
   calls `buyTickets` (`lib/shop/orders.ts`), each ticket by its id `<tier>/<package>`
   ("ruby-red/3-days"). The order is saved in `shop_orders`, and its IFZA payment is made at once
   (`preparePayment`, IFZA's "create payment": amount, currency, the order ref as reference, the
   billing address), so a refusal shows on the form. The browser goes to `/pay/<ref>`.
2. `/pay/<ref>` (`app/pay/[ref]/page.tsx`, `components/CardPayment.tsx`): Telr's card fields, loaded
   from `secure.telr.com` with the `telr_init` IFZA gave. "Pay" turns the card into a one-time token
   in Telr's frame; only the token comes to our server (`app/api/pay`), which checks the payment out
   at IFZA (`payWithCard`) and gets the bank's check (3-D Secure), shown in a frame on the page.
   Card details never reach this server. The payment link `/shop/pay/<ref>` (emails) opens this page.
3. The bank's check returns to `/shop/return/<ref>` (IFZA's `return_url`), as IFZA's guide says:
   inside the frame it sends the payment to the payment page with `postMessage` (this site's origin
   only), and that page asks our server (`/api/pay/status`); as the whole page (a bank that left the
   frame) our server asks itself. Either way the status comes from IFZA (`settle`, never the
   `outcome` in the address), then `/thank-you?orderid=<ref>` when paid, else `/payment/pending`,
   `/payment/denied` or `/payment/cancel`. IFZA sends no notification: every 3 minutes the server
   asks IFZA about orders whose card was sent and that aren't decided yet (`sweep`,
   `instrumentation.ts`), so a buyer who paid and closed the page still gets the tickets.
4. **Paid:** the buyer becomes a member like the members app's Admin > Members > New does it: a new
   account "pending activation" with the order's tier (the highest of the order) and a CJ300 number,
   or the existing member's tier goes up; each ticket bought gives its ticket types with QR codes.
   No activation link is sent: staff send the invitation from the members app (Admin > Members >
   Re-send invitation). Email: "Your payment is confirmed".
5. **Declined or cancelled:** once per order, "One more step to join us". Its "Complete your
   payment" (`/shop/retry/<ref>`) makes a new order for the same tickets (IFZA takes each reference
   once) and opens its payment page; its "Alternative payment option" goes to `SHOP_ALT_PAYMENT_URL`.

An order holds its tickets for 30 minutes, as long as an IFZA payment lasts: after that `/pay`
offers "Start again" (a new order, stock checked again).

| File | |
|---|---|
| `lib/shop/products.ts` | what's sold: per tier and day package the price, the tier it gives and its ticket types (FRI, SAT, SUN, AFTER; Ultra Black also PARK), stock |
| `lib/shop/orders.ts` | event, prices and stock for the site, orders, payment (prepare, card, status, sweep), retry |
| `lib/shop/fulfil.ts` | member, membership and tickets after payment |
| `lib/shop/ifza.ts` | IFZA's payment API (create, checkout, status) |
| `lib/shop/email.ts`, `templates.ts` | the two emails |
| `lib/shop/admin.ts` | the sales dashboard's API |
| `lib/shop/db.ts` | the database (MySQL, `mysql2`); makes the shop's tables on first use |
| `app/Api/Eventsnew/[name]`, `app/shop/...`, `app/api/pay`, `app/api/pay/status` | the HTTP routes |
| `app/pay/[ref]`, `components/CardPayment.tsx` | the payment page with Telr's card fields |

The currency (`SHOP_CURRENCY`, USD) must be one IFZA's store accepts, else IFZA refuses the
payment and `/summary` says "Payment isn't available for your order right now". The return domain
(`SHOP_PUBLIC_URL`, else `SHOP_SITE_URL`, https) must be registered with IFZA.

Security:

- **The site calls the shop directly**, not over HTTP. Its HTTP routes `Api/Eventsnew/...` and
  `shop/admin/...` are no longer used by the site and answer 401 without `SHOP_ADMIN_KEY` as a
  bearer token (`lib/shop/key.ts`), so every order passes the checkout's checks (age, terms, ...).
  `shop/pay`, `shop/return`, `shop/retry` and `shop/email` stay open: buyers, the bank check and the emails use them.
- **Payment status comes from IFZA only** (`PAID`), never from a request; reference, payment id,
  amount and currency must match the order.
- **The API key stays on the server** (`IFZA_API_KEY`, sent in `X-Api-Key`), never in the browser.
- **Content-Security-Policy:** Telr's script and frames (`secure.telr.com`) are allowed on `/pay/<ref>`
  only; only `/shop/return/<ref>` may be framed, by this site only (`next.config.ts`).
- **Unpaid orders** (in the last hour): 5 per email and 20 per buyer address (`X-Forwarded-For`,
  as the proxy in front of the site passes it), so nobody fills the orders or sends "One more step
  to join us" to someone else's email over and over.
- **Dashboard sign-in:** 5 wrong passwords per email and 20 per address in 15 minutes, counted in
  `shop_sign_in_failures` (survives restarts, shared by several servers).
- **Database user:** made and given its permissions on the server by hand (not by this project).
  It needs everything on the `shop_` tables (the site makes them), and on the members app's tables:
  read `events`, `membership_tiers`, `ticket_types`; read and add `users`, `members`, `memberships`,
  `tickets`; change `updated_at` of `users` and `members` (the shop locks those rows), `tier_id`,
  `status`, `updated_at` of `memberships`; add `ticket_credentials`, `audit_logs`.

The database: one, the members app's (`joia_dev` locally). Its own tables (`users`, `members`,
`memberships`, `tickets`, ...) and the shop's, made by the site on first use: `shop_orders`,
`shop_sign_in_failures`, `pre_registrations` (the pre-registration form), `shop_registration_attempts`,
`shop_locks`. Times are stored in UTC, as the members app stores them.
Prisma's `migrate dev` in the members app sees the `shop_` tables as drift and offers to reset the
database: answer no (it would delete everything). On the live server `migrate deploy` doesn't check this.

All settings are in one file, `.env` (or the server's environment), in blocks with comments:

```bash
ALFRED_UAE_URL=https://tiqs.it              # optional: old Alfred ticket emails' links (PDF, QR) keep working; read at build time
IP_ALLOWLIST="127.0.0.1, ::1"               # optional: only these addresses/ranges reach the site at all (pages, APIs, files, the bank check's return); others get 403. Empty = off. Uses the last X-Forwarded-For entry, so the site must listen on 127.0.0.1 behind nginx (lib/ip-allowlist.ts)
MAINTENANCE_MODE=true                       # optional: visitors get the pre-registration page (below); /admin, the ticket shop's routes and ticket email links stay open; restart to apply
MAINTENANCE_KEY=long-random-text            # optional: developers open the site once with ?dev=<this key> during maintenance

# the database: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (above)
SHOP_EVENT=abu-dhabi-2026                   # the event on sale, by its slug (members app: Admin > Events)
SHOP_CURRENCY=USD
SHOP_SITE_URL=https://clubjoia300.com       # this site: the payment page, the bank check's return (IFZA's registered return domain), email links
SHOP_SUPPORT_PHONE="+971 ..."               # the phone in the emails, else the event's support phone
SHOP_ALT_PAYMENT_URL=                       # optional: "Alternative payment option", default <SHOP_SITE_URL>/tickets
SHOP_TIMEZONE=Asia/Dubai                    # optional: the sales dashboard's days
SHOP_ADMIN_KEY=long-random-text             # 16+ characters: the key of the ticket and dashboard APIs, and the dashboard cookie's
SALES_DASHBOARD=on                          # the sales dashboard (/admin, /shop/admin) is closed (404) unless this is "on"
MFA_ENCRYPTION_KEY=...                      # the members app's MFA_ENCRYPTION_KEY, same value: dashboard sign-in checks the admins' authenticator codes
IFZA_API_KEY=ifza_ik_live_...               # issued by IFZA (starts in test mode); server only, never in the browser
IFZA_STORE=Elixium-Events-Test              # IFZA, IFZA-Test, Elixium-Events or Elixium-Events-Test: a -Test store while the key is in test mode
EMAIL_DRIVER=postmark                       # postmark sends the emails through Postmark, smtp through SMTP_URL, console only writes them to the log
EMAIL_FROM="CLUB JOIA 300 <noreply@clubjoia300.com>"   # must be a confirmed Sender Signature (or verified domain) in Postmark
POSTMARK_SERVER_TOKEN=...                   # Postmark: Servers > <server> > API Tokens; the server's IP must be in Postmark's IP allow list
POSTMARK_MESSAGE_STREAM=outbound            # optional, default outbound
SMTP_URL=smtp://user:pass@host:587          # only for EMAIL_DRIVER=smtp
EMAIL_FROM="CLUB JOIA 300 <noreply@tiqs.com>"
PREREG_NOTIFY_EMAIL=team@example.com         # optional: the team inbox told about each pre-registration
PREREG_SEND_CONFIRMATION=1                  # optional: 0 sends the guest no "we received it" email
```

IFZA's test cards (test store, any future expiry): 4111 1111 1111 1111 with CVV 123 approved,
999 on hold, 041 declined.

## Pre-registration page (maintenance mode)

While `MAINTENANCE_MODE=true`, visitors get the CLUB JOIA 300 pre-registration page at `/` instead
of the site (`proxy.ts`); every other page sends them there, and other APIs answer 503. Developers
still open the full site with `?dev=<MAINTENANCE_KEY>`.

- `public/preregister/` — the page as designed (`index.html`, `privacy.html` served at `/privacy` (`next.config.ts`), `assets/`: styles,
  script, self-hosted fonts and images). Its text is in `index.html`.
- `app/api/preregister/route.ts`, `lib/preregister.ts` — its form: checks, saving, emails. Was the
  package's `register.php`; now `pre_registrations` in the same database (one row per
  submission, the same email may come several times). Spam protection as before: a hidden field bots fill in, a minimum fill
  time of 3 seconds, only from this site's own page, 5 submissions per hour per connection (an
  anonymised code, `shop_registration_attempts`; the IP address itself is never stored).
- Emails: the team (`PREREG_NOTIFY_EMAIL`) about each one, the guest a short confirmation.
- `/admin/registrations` — the list, search and CSV download, behind the dashboard's sign-in (was
  the package's PHP admin with its own password).

Before launch, `public/preregister/privacy.html` needs its last highlighted placeholder filled in:
the legal company name and registered address. (Privacy contact: the Data Protection Officer,
DPO@clubjoia300.com; retention: 180 days from the date of delivery.)

## Sales dashboard (/admin)

Ticket orders with figures, charts, filters, an order list, each order's detail and a CSV export, read only. Staff sign in with their account of the members app (admins only, Argon2 password in its `users` table) **and the 6-digit code of their authenticator app** (two-factor sign-in): the shop's admin API checks both (`/shop/admin/login`), this site keeps a signed cookie for 12 hours. Every page asks the API again, so a staff member disabled in the members app, or whose two-factor sign-in was reset there, is signed out here. Sign-ins and wrong codes go to its audit log (`shop.dashboard_sign_in`, `shop.dashboard_mfa_failed`).

Two-factor sign-in: admins set up the authenticator in the members app's staff portal (it asks at their first sign-in there); this site has no set-up of its own. `lib/shop/totp.ts` is a copy of the members app's `src/lib/security/totp.ts`, and `MFA_ENCRYPTION_KEY` must be the same in both apps. Each code works once, in either app (`users.mfa_last_used_step`, added by the members app's migration `20261111120000_mfa_last_used_step`).

- `app/admin/` — the dashboard (`page.tsx`), sign-in (`login/`, `actions.ts`), an order (`orders/[ref]/`), the CSV (`export/route.ts`).
- `lib/admin/` — session cookie, API calls, filters (days in Dubai time), formats, CSV. `components/admin/` — charts and shared pieces.
- `/admin` stays open during maintenance, it has its own sign-in.

`SHOP_ADMIN_KEY` (any long random text, 16+ characters) is the bearer token between the site's
server and its APIs, and signs the dashboard's cookie.

## Going live

1. The site and the database are on the same server. Make the site's database user there yourself,
   with the permissions above, and put it in `.env` (`DB_HOST="127.0.0.1"`).
2. `.env` as above (`IFZA_STORE` a `-Test` store first; `.env` isn't in git, put it on the server yourself), then
   `npm ci && npm run build`, `npm run db:setup` (makes the site's tables now: it prints which
   database it used, or why it failed) and restart. The database user needs CREATE for that.
3. IFZA: the return domain `https://clubjoia300.com` registered, the store accepting USD.
4. Buy once with IFZA's test cards (paid, declined, cancelled) and check the emails, the member and
   tickets in the members app, and `/admin`. Then ask IFZA to switch the key to production, set the
   live store (`IFZA_STORE=Elixium-Events` or `IFZA`), restart, and switch `MAINTENANCE_MODE` off.
