# Club JOIA 300

Next.js version of the Club JOIA 300 ticket site (clubjoia300.com). Design and booking flow are identical to the original static site; tickets are sold through the members app and paid with Telr.

## Run

```bash
npm install
npm run dev      # development, http://localhost:3000
npm run build && npm start   # production
npm test         # unit tests (tests/, Vitest); the ticket backend is faked by tests/alfred-mock.ts
```

The site needs its ticket backend running (see Payment below). Locally that's the members app
`/var/www/html/club-joia-300-white`, started with `sh local/start.sh` there (port 3101).

## Where things live

- `lib/config.ts` — access levels, day packages, benefits, sold-out flags and payment settings. Its prices and currency are only used while the backend can't be reached.
- `lib/catalog.ts` — prices, currency and sold out from the backend (`buyTicketsTicketTypes`, `buyTicketsSoldOut`, `buyTicketsEvents`). Pages get the last answer at once and a newer one is fetched behind it after a minute; prices show a shimmering bar until the backend has answered (`components/Price.tsx` on server pages, `lib/prices.tsx` for client components) and "Price unavailable" when it can't be reached.
- `lib/cart.ts` — the cart, kept in `sessionStorage` (key `cj300-cart`) so it survives page changes.
- `app/globals.css` — the original `main.css`, unchanged except that `-webkit-backdrop-filter` is declared before `backdrop-filter` (the CSS minifier drops the standard one otherwise).
- `app/` — one folder per page: `/`, `/ruby-red`, `/pearly-white`, `/ultra-black`, `/tickets`, `/summary`, `/thank-you`, plus `not-found.tsx`.
- `public/assets/` — images.

Old addresses such as `/tickets.html` or `/thank-you.html` redirect permanently to the new ones (see `next.config.ts`), so shared links and payment success URLs keep working.

## Payment (members app + Telr)

Tickets are sold by the members app (`club-joia-300-white`, live at `admin.clubjoia300.com`): its
`shop/` folder takes the order, pays it with **Telr** in **USD**, then makes the buyer a member with
the tickets (QR codes in the member app) and sends the emails. How it works there:
`club-joia-300-white/shop/README.md`. Alfred is no longer used; the backend answers the same calls
Alfred did, so the variable names still say `ALFRED_`.

1. `/summary`: the buyer fills in their details. `app/api/checkout/route.ts` checks the form and
   calls the backend's `Api/Eventsnew/buyTickets` (shared calls in `lib/alfred.ts`), each ticket by
   its id `<tier>/<package>` ("ruby-red/3-days").
2. The browser goes to the payment link it returns (`/shop/pay/<ref>`), which opens Telr's payment page.
3. Back from Telr, the backend sends the buyer to `/thank-you?orderid=<ref>` when paid, else to
   `/payment/pending`, `/payment/denied` or `/payment/cancel`.
4. Emails, from the backend: "Your payment is confirmed" and "Your Club JOIA 300 tickets" (the
   account's activation link), or "One more step to join us" after a declined or cancelled payment.
   Telr also emails its own receipt to the address typed on its page.

The currency is the backend's (`SHOP_CURRENCY`, USD), and the Telr store must accept the same one,
else Telr refuses the order and `/summary` says "Payment isn't available for your order right now".
Prices and stock are the backend's too (`shop/products.cjs` there).

Settings, in `.env.local` (or the server's environment):

```bash
ALFRED_URL=https://admin.clubjoia300.com    # the backend (members app), no trailing slash; locally http://127.0.0.1:3101
ALFRED_EVENT_ID=abu-dhabi-2026              # the event's slug in the members app (its SHOP_EVENT)
ALFRED_VENDOR_ID=40                         # sent along as Alfred did, the backend doesn't use it
ALFRED_UAE_URL=https://tiqs.it              # optional: old Alfred ticket emails' links (PDF, QR) keep working; read at build time
MAINTENANCE_MODE=true                       # optional: the site shows a maintenance page, /admin and ticket email links keep working; restart to apply
MAINTENANCE_KEY=long-random-text            # optional: developers open the site once with ?dev=<this key> during maintenance
SHOP_ADMIN_KEY=long-random-text             # the sales dashboard, see below
```

Known gap: "Also receive tickets via SMS" adds `payment.smsFee` to the total on `/summary`, but the
backend doesn't charge it (Telr gets the total without it).

## Sales dashboard (/admin)

Ticket orders with figures, charts, filters, an order list, each order's detail and a CSV export, read only. Staff sign in with their account of the members app (admins only): the backend checks the password (`/shop/admin/login`), this site keeps a signed cookie for 12 hours. Every page asks the backend again, so a staff member disabled there is signed out here.

- `app/admin/` — the dashboard (`page.tsx`), sign-in (`login/`, `actions.ts`), an order (`orders/[ref]/`), the CSV (`export/route.ts`).
- `lib/admin/` — session cookie, backend calls, filters (days in Dubai time), formats, CSV. `components/admin/` — charts and shared pieces.
- `/admin` stays open during maintenance, it has its own sign-in.

```bash
SHOP_ADMIN_KEY=long-random-text   # the same value as SHOP_ADMIN_KEY in the backend's .env
```

## Going live

1. Backend first: its `shop/` folder and `server.js` line on the server, its `.env` (Telr, USD,
   SMTP, `SHOP_ADMIN_KEY`), restart. Steps in `club-joia-300-white/shop/README.md`.
2. In Telr's dashboard: transaction advice URL `https://admin.clubjoia300.com/shop/telr/advice`.
3. This site: `.env.local` as above, then `npm ci && npm run build` and restart.
4. With `TELR_TEST=1` on the backend, buy once (paid and declined) from the live site and check the
   emails, the member and tickets, and `/admin`. Then `TELR_TEST=0` when Telr has approved the
   store, and switch `MAINTENANCE_MODE` off.
