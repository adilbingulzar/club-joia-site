# Club JOIA 300

Next.js version of the Club JOIA 300 ticket site (clubjoia300.com). Design and booking flow are identical to the original static site; tickets are sold by the site's own ticket shop (`lib/shop`) and paid with Telr.

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

## Ticket shop (Telr)

The site sells the tickets itself, in **USD**, paid with **Telr**, and writes the buyer as a member
with the tickets into the members app's MySQL database (`club-joia-300-backend`, whose code isn't
used: only its database). Alfred is no longer used. The site's pages call the shop's functions
directly (`lib/shop`), not over HTTP.

1. `/summary`: the buyer fills in their details. `app/api/checkout/route.ts` checks the form and
   calls `buyTickets` (`lib/shop/orders.ts`), each ticket by its id `<tier>/<package>`
   ("ruby-red/3-days"). The order is saved in `shop_orders`.
2. The checkout makes the Telr order (`payUrl`) and sends the browser to Telr's payment page.
   (`/shop/pay/<ref>` does the same for a link.)
3. Back from Telr (`/shop/telr/return/<ref>`), or Telr's transaction advice (`/shop/telr/advice`):
   the status is asked from Telr, never taken from the request. Then `/thank-you?orderid=<ref>`
   when paid, else `/payment/pending`, `/payment/denied` or `/payment/cancel`.
4. **Paid:** the buyer becomes a member like the members app's Admin > Members > New does it: a new
   account "pending activation" with the order's tier (the highest of the order) and a CJ300 number,
   or the existing member's tier goes up; each ticket bought gives its ticket types with QR codes.
   No activation link is sent: staff send the invitation from the members app (Admin > Members >
   Re-send invitation). Email: "Your payment is confirmed".
5. **Declined or cancelled:** once per order, "One more step to join us". Its "Complete your
   payment" (`/shop/retry/<ref>`) makes a new order for the same tickets and opens Telr; its
   "Alternative payment option" goes to `SHOP_ALT_PAYMENT_URL`.

Telr also emails its own receipt to the address typed on its page (switched off at Telr).

| File | |
|---|---|
| `lib/shop/products.ts` | what's sold: per tier and day package the price, the tier it gives and its ticket types (FRI, SAT, SUN, AFTER; Ultra Black also PARK), stock |
| `lib/shop/orders.ts` | event, prices and stock for the site, orders, payment link, Telr's answers, retry |
| `lib/shop/fulfil.ts` | member, membership and tickets after payment |
| `lib/shop/telr.ts` | Telr's order.json (create, check) |
| `lib/shop/email.ts`, `templates.ts` | the two emails |
| `lib/shop/admin.ts` | the sales dashboard's API |
| `lib/shop/db.ts` | the database (MySQL, `mysql2`); makes the shop's tables on first use |
| `app/Api/Eventsnew/[name]`, `app/shop/...` | the HTTP routes |

The currency (`SHOP_CURRENCY`, USD) must be one the Telr store accepts, else Telr refuses the order
(E05) and `/summary` says "Payment isn't available for your order right now".

Security:

- **The site calls the shop directly**, not over HTTP. Its HTTP routes `Api/Eventsnew/...` and
  `shop/admin/...` are no longer used by the site and answer 401 without `SHOP_ADMIN_KEY` as a
  bearer token (`lib/shop/key.ts`), so every order passes the checkout's checks (age, terms, ...).
  `shop/pay`, `shop/telr`, `shop/retry` and `shop/email` stay open: buyers, Telr and the emails use them.
- **Payment status comes from Telr only**, never from a request; cart, amount, currency and test
  flag must match the order.
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
MAINTENANCE_MODE=true                       # optional: visitors get the pre-registration page (below); /admin, the ticket shop's routes and ticket email links stay open; restart to apply
MAINTENANCE_KEY=long-random-text            # optional: developers open the site once with ?dev=<this key> during maintenance

# the database: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (above)
SHOP_EVENT=abu-dhabi-2026                   # the event on sale, by its slug (members app: Admin > Events)
SHOP_CURRENCY=USD
SHOP_SITE_URL=https://clubjoia300.com       # this site: Telr's return, the payment and email links
SHOP_SUPPORT_PHONE="+971 ..."               # the phone in the emails, else the event's support phone
SHOP_ALT_PAYMENT_URL=                       # optional: "Alternative payment option", default <SHOP_SITE_URL>/tickets
SHOP_TIMEZONE=Asia/Dubai                    # optional: the sales dashboard's days
SHOP_ADMIN_KEY=long-random-text             # 16+ characters: the key of the ticket and dashboard APIs, and the dashboard cookie's
TELR_STORE_ID=...                           # Telr: Integrations > Hosted Payment Page > Request Authentication
TELR_AUTH_KEY=...
TELR_TEST=1                                 # 1 test payments, 0 live
EMAIL_DRIVER=smtp                           # smtp sends the emails, console only writes them to the log
SMTP_URL=smtp://user:pass@host:587
EMAIL_FROM="CLUB JOIA 300 <noreply@tiqs.com>"
PREREG_NOTIFY_EMAIL=team@example.com         # optional: the team inbox told about each pre-registration
PREREG_SEND_CONFIRMATION=1                  # optional: 0 sends the guest no "we received it" email
```

In Telr's dashboard, the transaction advice URL is `<SHOP_SITE_URL>/shop/telr/advice`.

## Pre-registration page (maintenance mode)

While `MAINTENANCE_MODE=true`, visitors get the CLUB JOIA 300 pre-registration page at `/` instead
of the site (`proxy.ts`); every other page sends them there, and other APIs answer 503. Developers
still open the full site with `?dev=<MAINTENANCE_KEY>`.

- `public/preregister/` — the page as designed (`index.html`, `privacy.html`, `assets/`: styles,
  script, self-hosted fonts and images). Its text is in `index.html`.
- `app/api/preregister/route.ts`, `lib/preregister.ts` — its form: checks, saving, emails. Was the
  package's `register.php`; now `pre_registrations` in the same database (one row per
  email: a repeat updates it). Spam protection as before: a hidden field bots fill in, a minimum fill
  time of 3 seconds, only from this site's own page, 5 submissions per hour per connection (an
  anonymised code, `shop_registration_attempts`; the IP address itself is never stored).
- Emails: the team (`PREREG_NOTIFY_EMAIL`) about each one, the guest a short confirmation.
- `/admin/registrations` — the list, search and CSV download, behind the dashboard's sign-in (was
  the package's PHP admin with its own password).

Before launch, `public/preregister/privacy.html` needs its four highlighted placeholders filled in
(company name and address, privacy contact email twice, retention period).

## Sales dashboard (/admin)

Ticket orders with figures, charts, filters, an order list, each order's detail and a CSV export, read only. Staff sign in with their account of the members app (admins only, Argon2 password in its `users` table): the shop's admin API checks it (`/shop/admin/login`), this site keeps a signed cookie for 12 hours. Every page asks the API again, so a staff member disabled in the members app is signed out here. Sign-ins go to its audit log (`shop.dashboard_sign_in`).

- `app/admin/` — the dashboard (`page.tsx`), sign-in (`login/`, `actions.ts`), an order (`orders/[ref]/`), the CSV (`export/route.ts`).
- `lib/admin/` — session cookie, API calls, filters (days in Dubai time), formats, CSV. `components/admin/` — charts and shared pieces.
- `/admin` stays open during maintenance, it has its own sign-in.

`SHOP_ADMIN_KEY` (any long random text, 16+ characters) is the bearer token between the site's
server and its APIs, and signs the dashboard's cookie.

## Going live

1. The site and the database are on the same server. Make the site's database user there yourself,
   with the permissions above, and put it in `.env` (`DB_HOST="127.0.0.1"`).
2. `.env` as above (`TELR_TEST=1` first; `.env` isn't in git, put it on the server yourself), then
   `npm ci && npm run build`, `npm run db:setup` (makes the site's tables now: it prints which
   database it used, or why it failed) and restart. The database user needs CREATE for that.
3. In Telr's dashboard: transaction advice URL `https://clubjoia300.com/shop/telr/advice`, and the
   store accepting USD.
4. Buy once (paid and declined) from the live site and check the emails, the member and tickets in
   the members app, and `/admin`. Then `TELR_TEST=0` when Telr has approved the store, and switch
   `MAINTENANCE_MODE` off.
