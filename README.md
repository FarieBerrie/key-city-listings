# Key City Listings

Key City Listings is a local marketplace that connects contractors with small businesses in Abilene, Texas and nearby Big Country towns. Businesses join free, post job requests, and message contractors. Contractors pay for a monthly listing before their profile appears in the public directory.

The product name and the listing plan labels live in [`lib/config.ts`](lib/config.ts). Change `site.name` there and the page titles, header, and footer follow.

## Stack

- Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui
- Prisma with Postgres (Prisma's built-in local Postgres for development, Render Postgres in production)
- Cookie sessions signed with `jose`, passwords hashed with bcrypt
- Stripe Checkout subscriptions, Stripe's customer portal, and a webhook that keeps each listing in step with its subscription
- Email through Resend (password resets and new-message notifications)
- A mock billing mode so the app runs on your machine with no Stripe keys

## Local setup

You need Node.js 20.12 or newer.

```bash
npm install
cp .env.example .env
npm run db:dev        # start the local Postgres (stays running in the background)
npm run db:migrate
npm run db:seed
npm run dev
```

The app listens on [http://127.0.0.1:43123](http://127.0.0.1:43123). `http://localhost:43123` works too.

- `npm install` also generates the Prisma client, through the `postinstall` script.
- `npm run db:dev` runs Prisma's built-in Postgres, so there's nothing else to install. After a reboot, run it again before `npm run dev`; `npm run db:stop` stops it. The `DATABASE_URL` in `.env.example` points at it.
- Emails aren't sent in development. They're printed in the terminal running `npm run dev`, so you can click a password-reset link from there.
- The placeholder `AUTH_SECRET` from `.env.example` works on your own machine, but production refuses to start with it.

`npm run db:seed` wipes and recreates the sample data, and refuses to run against any database that isn't on your machine. Every sample account uses the password `keycitylistings`. On your machine, the login page also has one-click buttons for two of them.

| Role | Business | Email |
| --- | --- | --- |
| Business | Elm & Pine Cafe | nora@elmpinecafe.example |
| Business | Sayles Street Books | elliot@saylesbooks.example |
| Business | Cedar Creek Dental | priya@cedarcreekdental.example |
| Business | Mockingbird Mini Storage | hank@mockingbirdstorage.example |
| Contractor | Red River Electric | mara@redriverelectric.example |
| Contractor | Catclaw Plumbing Co. | luis@catclawplumbing.example |
| Contractor | Buffalo Gap Air | denise@buffalogapair.example |
| Contractor | Mesa Stone Roofing | grant@mesastoneroofing.example |
| Contractor | Lytle Creek Painters | asha@lytlecreekpainters.example |
| Contractor | Prairie Line Landscaping | caleb@prairielinelandscaping.example |
| Contractor | Sayles General Builders | june@saylesbuilders.example |
| Contractor | Cedar Ridge Electric | pete@cedarridgeelectric.example |

Seeded contractors already have active listings (a mix of Basic and Featured). A contractor who signs up starts unlisted until they activate a plan.

## How billing works

Public search and profile pages include a contractor only when their listing status is `ACTIVE` and the current period has not ended. Tiers are `BASIC` and `FEATURED`. Featured listings sort first and show a badge. The plan list in `lib/config.ts` is the place to add another tier later.

**Mock mode (development).** `BILLING_MODE=mock`, or leave the Stripe keys empty. The listing page shows "Activate Basic" and "Activate Featured", which switch the listing on without contacting Stripe. Production never uses mock mode: it ignores `BILLING_MODE=mock` unless `ALLOW_MOCK_BILLING=true` is also set (for a private staging site), and until Stripe is configured the listing page says subscriptions aren't available yet.

**Stripe.** A contractor subscribes through Stripe Checkout. Once they have a subscription, the listing page offers **Manage subscription**, which opens Stripe's customer portal to change plan, update the card, see invoices, or cancel. Plan changes always go through the portal, so nobody can end up with two subscriptions. Cancelling keeps the listing up until the end of the paid period. Checkout accepts Stripe promotion codes, which is the way to give early contractors a free month.

Checkout doesn't switch the listing on by itself; the webhook does. It handles `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` and `invoice.payment_failed`, and each time it reads the subscription's current state from Stripe, so events that arrive late or out of order can't leave a listing wrong. A past-due or canceled subscription drops the profile out of search.

To try Stripe locally, put test-mode keys and price IDs in `.env`, set `BILLING_MODE="stripe"`, and forward webhooks with the Stripe CLI:

```bash
stripe listen --forward-to localhost:43123/api/stripe/webhook
```

Put the signing secret it prints in `STRIPE_WEBHOOK_SECRET`.

Update the dollar labels in `listingPlans` inside `lib/config.ts` if you change the Stripe prices. Those labels are what the page shows. The amount Stripe charges comes from the Price object.

## Going live

The site runs on [Render](https://render.com): a web service and a Postgres database, both described in [`render.yaml`](render.yaml). At the smallest paid sizes that's about $7 a month for the web service and $6 a month plus $0.30 per GB of storage for the database. Check render.com/pricing for current prices. Render's free tier isn't suitable: free services sleep when idle and free databases are deleted after 30 days.

You'll need accounts with Render, Stripe and Resend, and a domain name.

### 1. Create the service on Render

1. Push this repository to GitHub (it's private, so give Render's GitHub app access to it).
2. In the Render Dashboard, choose **New > Blueprint** and pick the repository. Render reads `render.yaml` and creates the database and the web service.
3. It asks for the values marked `sync: false`. Fill in `BUSINESS_LEGAL_NAME` and `CONTACT_EMAIL` now. The rest can wait: without Stripe, the listing page says subscriptions aren't available yet; without Resend, no emails go out.
4. Render generates `AUTH_SECRET` and connects `DATABASE_URL` to the database itself.

Each deploy installs, builds, applies new database migrations, and switches traffic over only once `/api/health` answers, so a failed deploy leaves the previous version running. Pushing to `main` deploys automatically.

Don't run `npm run db:seed` against the live database; it refuses anyway.

### 2. Set up Stripe

Do this in **test mode** first, try the whole flow, then repeat in live mode with live keys.

1. Create a product with two recurring monthly prices, Basic and Featured. Copy their `price_...` IDs into `STRIPE_PRICE_BASIC` and `STRIPE_PRICE_FEATURED`.
2. Copy the secret key into `STRIPE_SECRET_KEY`.
3. Add a webhook endpoint for `https://<your site>/api/stripe/webhook` with the five events listed under [How billing works](#how-billing-works). Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Configure the **customer portal** (Settings > Billing > Customer portal) and save it, in test and in live mode:
   - allow updating payment methods and viewing invoices;
   - allow cancelling, **at the end of the billing period** (the Terms of Service promise that);
   - allow switching plans, between the Basic and Featured prices.
5. Set the environment variables on Render and let it redeploy. Subscribe as a contractor with the test card `4242 4242 4242 4242`, check the listing appears, switch plan and cancel through **Manage subscription**.

Stripe reviews your website before switching on live payments. The Terms, Privacy and Contact pages, linked from every page's footer, cover what it looks for.

### 3. Set up email

1. In Resend, add your domain and add the DNS records it shows, so mail from your domain is trusted.
2. Create an API key with sending access and put it in `RESEND_API_KEY`.
3. Set `EMAIL_FROM` to an address on that domain, such as `Key City Listings <hello@yourdomain.com>`.

Try "Forgot your password?" on the login page to check it.

### 4. Connect your domain

Add the domain under the web service's **Settings > Custom Domains** and create the DNS record Render shows; Render issues the HTTPS certificate. Then set `NEXT_PUBLIC_APP_URL` to `https://yourdomain.com` and change the Stripe webhook URL to the new domain. Until then, the site uses its `onrender.com` address.

### 5. Before you announce it

- Read the [Terms](app/terms/page.tsx) and [Privacy Policy](app/privacy/page.tsx) and have someone qualified review them. They're drafts written from how the site works. Check in particular the refund policy (no refunds for partial months), the liability cap, and the choice of Taylor County courts. Update `policiesUpdated` in `lib/config.ts` whenever you change either one.
- Ask an accountant whether sales tax applies to listing fees; Stripe Tax can collect it.
- Optional: set `ERROR_ALERT_WEBHOOK_URL` to a Slack or Discord incoming webhook to get a message when the server hits an error. Errors are always in the service's **Logs** tab on Render.

## Environment variables

| Variable | Needed in production | What it's for |
| --- | --- | --- |
| `DATABASE_URL` | Yes (Render sets it) | Postgres connection string |
| `AUTH_SECRET` | Yes (Render generates it) | Signs login cookies. At least 32 characters; production won't start with the placeholder |
| `NEXT_PUBLIC_APP_URL` | Once you have a domain | The site's public address, used in emails and Stripe redirects. Falls back to Render's `onrender.com` address |
| `BUSINESS_LEGAL_NAME`, `CONTACT_EMAIL` | Yes | Shown on the Terms, Privacy and Contact pages |
| `BILLING_MODE` | Set to `stripe` | `mock` is for development |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_FEATURED` | For subscriptions | See [Set up Stripe](#2-set-up-stripe) |
| `RESEND_API_KEY`, `EMAIL_FROM` | For email | See [Set up email](#3-set-up-email) |
| `ERROR_ALERT_WEBHOOK_URL` | Optional | Slack or Discord webhook for error alerts |
| `ALLOW_MOCK_BILLING`, `ENABLE_DEMO_LOGINS`, `ALLOW_REMOTE_SEED` | No | Overrides for a private staging site only |

At startup, production logs a `[config]` warning for anything missing, and exits if `AUTH_SECRET` or `DATABASE_URL` isn't usable.

## Scripts

- `npm run dev` — local server on port 43123
- `npm run build` — production build
- `npm start` — serve the production build on port 43123
- `npm run db:dev` / `npm run db:stop` — start or stop the local Postgres
- `npm run db:migrate` — apply Prisma migrations
- `npm run db:seed` — load sample Abilene businesses and contractors (local databases only)
- `npm run db:reset` — drop the database, migrate, and seed. Prisma refuses to run this when an AI coding agent starts it, so run it yourself.
- `npm run lint` — ESLint

## Security and reliability

- **Rate limits**, stored in the database: 10 login attempts per email and 30 per IP address every 15 minutes, 5 sign-ups per IP per hour, 3 reset emails per address per hour, 30 messages per user per 10 minutes, 20 new conversations and 10 job posts per user per hour.
- **Password resets** use a random token that works once and expires in an hour; only its hash is stored. Resetting a password signs out every device logged in to that account.
- **Security headers** on every response, set in `next.config.ts`: a Content Security Policy (without nonces, which would switch off this app's prerendered pages), clickjacking protection, a strict referrer policy so reset links never leak, and HSTS once the site is on HTTPS.
- **Errors** are written to the log as one JSON line each (`instrumentation.ts`), with an optional alert webhook.
- `/api/health` checks the database; Render uses it to decide when a deploy is ready. `robots.txt` and `sitemap.xml` are generated per request.

## Project configuration

- **`prisma.config.ts`** holds Prisma's settings: where the schema is and the seed command. Once a config file exists, Prisma stops reading `.env` on its own, so this file loads `.env` itself. On a host that sets real environment variables, there's no `.env` and it skips that step.
- **`next.config.ts`** lists `127.0.0.1` in `allowedDevOrigins`. Next.js only trusts `localhost` by default, and without this entry it blocks live reload for anyone who opens the app at `127.0.0.1`. It also sets the security headers.
- **`allowScripts`** in `package.json` lists the dependencies that may run install scripts: Prisma, esbuild, and `unrs-resolver`, which ESLint uses. Each entry is pinned to a version. When one of them is upgraded, npm warns about it again. Check the new version, then run `npm approve-scripts <package>`.
- **`overrides`** in `package.json` pins `deepmerge-ts`, used by Prisma's CLI, to 8.x, which fixes a security advisory in 7.x. Remove it once Prisma depends on 8.x itself.
- **`engines`** in `package.json` sets the Node.js version, which Render also reads.

### Known install warnings

- `eslint@9 ... no longer supported`. ESLint 10 is out, but `eslint-plugin-react`, `eslint-plugin-jsx-a11y` and `eslint-plugin-import`, which `eslint-config-next` uses, don't support it yet. Upgrade once they do.
- `npm audit` reports high-severity advisories for `braces`. It's pulled in by development tools: the shadcn CLI, and Next's ESLint plugin through `fast-glob`. No patched version exists yet. The advisory concerns deeply nested glob patterns, and these tools only use the project's own patterns.
