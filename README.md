# Club JOIA 300

Next.js version of the Club JOIA 300 ticket site. Design and booking flow are identical to the original static site.

## Run

```bash
npm install
npm run dev      # development, http://localhost:3000
npm run build && npm start   # production
npm test         # unit tests (tests/, Vitest); Alfred is faked by tests/alfred-mock.ts
```

## Where things live

- `lib/config.ts` — access levels, day packages, benefits, sold-out flags and payment settings. Its prices and currency are only used while Alfred can't be reached.
- `lib/catalog.ts` — prices, currency and sold out from Alfred (`Tickettypes`, `Ticketsoldout`, `VendorEvents`). Pages get the last answer at once and a newer one is fetched behind it after a minute; prices show a shimmering bar until Alfred has answered (`components/Price.tsx` on server pages, `lib/prices.tsx` for client components) and "Price unavailable" when it can't be reached.
- `lib/cart.ts` — the cart, kept in `sessionStorage` (key `cj300-cart`) so it survives page changes.
- `app/globals.css` — the original `main.css`, unchanged except that `-webkit-backdrop-filter` is declared before `backdrop-filter` (the CSS minifier drops the standard one otherwise).
- `app/` — one folder per page: `/`, `/ruby-red`, `/pearly-white`, `/ultra-black`, `/tickets`, `/summary`, `/thank-you`, plus `not-found.tsx`.
- `public/assets/` — images.

Old addresses such as `/tickets.html` or `/thank-you.html` redirect permanently to the new ones (see `next.config.ts`), so shared links and payment success URLs keep working.

## Payment (Alfred)

Tickets are booked and paid in Alfred (`alfred_master`); the buyer details are filled in on `/summary`.

- `app/api/checkout/route.ts` checks the form, finds the Alfred ticket ids by name ("Ruby Red, 3 days", …) in the event, and calls Alfred's `Api/Eventsnew/buyTickets` (payment methods from `Api/Eventsnew/buyTicketsPaymentMethods`). The browser is sent to the payment page it returns.
- `app/api/checkout/methods/route.ts` lists the chosen gateway's payment methods (credit card, iDEAL, PayPal, …) with Alfred's icons, so the form shows them like Alfred's own shop. Shared Alfred calls are in `lib/alfred.ts`.
- The buyer picks the gateway; the country preselects one: United Arab Emirates → noon, Netherlands and Belgium → Pay.nl, every other country → MultiSafepay. noon and MultiSafepay charge the vendor's currency, Pay.nl and this site use the event's: keep both the same in Alfred.
- After payment Alfred sends the buyer to the event's success landing page: set it to `<site>/thank-you` (URL type).

Settings, in `.env.local` (or the server's environment):

```bash
ALFRED_URL=http://localhost/alfred_master   # Alfred base URL, no trailing slash
ALFRED_EVENT_ID=5263                        # the Club JOIA 300 event in Alfred
ALFRED_VENDOR_ID=462967                     # the event's vendor, for the event's currency
```

Ticket names, prices, the event's currency and stock live in Alfred; names must match `tier.name + ', ' + package.name` in `lib/config.ts`.
