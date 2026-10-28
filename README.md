# Club JOIA 300

Next.js version of the Club JOIA 300 ticket site. Design and booking flow are identical to the original static site.

## Run

```bash
npm install
npm run dev      # development, http://localhost:3000
npm run build && npm start   # production
```

## Where things live

- `lib/config.ts` — access levels, day packages, prices, benefits, sold-out flags and payment settings. Every page reads from here.
- `lib/cart.ts` — the cart, kept in `sessionStorage` (key `cj300-cart`) so it survives page changes.
- `app/globals.css` — the original `main.css`, unchanged except that `-webkit-backdrop-filter` is declared before `backdrop-filter` (the CSS minifier drops the standard one otherwise).
- `app/` — one folder per page: `/`, `/ruby-red`, `/pearly-white`, `/ultra-black`, `/tickets`, `/summary`, `/thank-you`, plus `not-found.tsx`.
- `public/assets/` — images.

Old addresses such as `/tickets.html` or `/thank-you.html` redirect permanently to the new ones (see `next.config.ts`), so shared links and payment success URLs keep working.

## Payment (Alfred)

Tickets are booked and paid in Alfred (`alfred_master`); the buyer details are filled in on `/summary`.

- `app/api/checkout/route.ts` checks the form, finds the Alfred ticket ids by name ("Ruby Red, 3 days", …) in the event, and calls Alfred's `Api/Eventsnew/buyTickets` (payment methods from `Api/Eventsnew/buyTicketsPaymentMethods`). The browser is sent to the payment page it returns.
- Alfred picks the payment engine from the buyer's country: United Arab Emirates → noon, every other country → MultiSafepay.
- After payment Alfred sends the buyer to the event's success landing page: set it to `<site>/thank-you` (URL type).

Settings, in `.env.local` (or the server's environment):

```bash
ALFRED_URL=http://localhost/alfred_master   # Alfred base URL, no trailing slash
ALFRED_EVENT_ID=5263                        # the Club JOIA 300 event in Alfred
```

Ticket names, prices (USD) and stock live in Alfred; names must match `tier.name + ', ' + package.name` in `lib/config.ts`.
