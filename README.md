# StudyCore Contracts

Full-stack contract management web app for **StudyCore LLC**. Closers create
SAT or ACT Tutoring Services Agreements; parents review, sign, and pay through a
secure link; admins oversee everything. The test type (SAT or ACT) is picked at
contract creation time and drives the agreement title, score labels, Stripe
product name, and every piece of email copy.

Live target: [`sign.studycore.net`](https://sign.studycore.net)

---

## Stack

- **Next.js 14** (App Router, Server Components, Route Handlers)
- **Supabase** — Postgres + Auth + Storage (signed PDFs)
- **Stripe** — Payment Element for amount due at signing
- **Resend** — branded transactional email from `contracts@studycore.net`
- **@react-pdf/renderer** — server-side PDF generation
- **react-signature-canvas** — finger / mouse signature
- **Tailwind CSS** + Inter font
- **Vercel** — deploy target

Brand: navy `#1A3C6B` · orange `#F97316`.

---

## Local development

```bash
# 1. Clone & install
git clone <repo> && cd StudyCore-Contracts
npm install

# 2. Configure environment
cp .env.example .env.local
# fill in the values (see "Environment variables" below)

# 3. Run the dev server
npm run dev
# → http://localhost:3000
```

## Environment variables

| Variable                              | Where to get it                                              |
| ------------------------------------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`            | Supabase → Project settings → API                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`       | Supabase → Project settings → API                            |
| `SUPABASE_SERVICE_ROLE_KEY`           | Supabase → Project settings → API (**keep secret**)          |
| `STRIPE_SECRET_KEY`                   | Stripe → Developers → API keys                               |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`  | Stripe → Developers → API keys                               |
| `STRIPE_WEBHOOK_SECRET`               | Stripe → Developers → Webhooks → endpoint signing secret     |
| `RESEND_API_KEY`                      | Resend → API Keys                                            |
| `NEXT_PUBLIC_APP_URL`                 | `https://sign.studycore.net` (or `http://localhost:3000`)    |

---

## 1. Supabase setup

1. Create a new Supabase project.
2. In the SQL editor, paste and run the entire file
   [`supabase/schema.sql`](./supabase/schema.sql). This creates:
   - `users` table (mirrors `auth.users`)
   - `contracts` table with all contract fields
   - Row Level Security policies for admins, closers, and parent signing
   - A public `contracts` storage bucket for signed PDFs
3. Create the **first admin** account. Two options:

   **A. From the Supabase dashboard**
   - Authentication → Users → "Add user" → email + password (mark email confirmed).
   - Then run this SQL to insert the matching profile row:
     ```sql
     insert into public.users (id, email, name, role, active)
     values ('<auth-user-uuid>', 'admin@studycore.net', 'StudyCore Admin', 'admin', true);
     ```

   **B. From psql**
   - Same idea: create the auth user, then insert the profile row above.

4. Confirm Storage → `contracts` bucket exists and is public.

After you have the first admin, every other closer is created from the in-app
**Admin → Closers** page.

---

## 2. Stripe setup

1. Create a Stripe account (or use the existing StudyCore account).
2. **Developers → API keys** → copy:
   - Secret key → `STRIPE_SECRET_KEY`
   - Publishable key → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. (Optional) In **Settings → Payment methods**, enable the methods you want
   parents to see (cards are on by default; ACH, Affirm, Klarna, etc. as
   desired). The signing page uses `automatic_payment_methods` so anything
   enabled in Stripe will appear.
4. **Configure the webhook.** This is required so payments made via the
   separately emailed Stripe Checkout link (the "Send contract only — payment
   link later" and "Send payment link first — contract later" flows) get
   recorded back on the contract.
   - **Developers → Webhooks → Add endpoint**
   - Endpoint URL: `https://<your-domain>/api/stripe/webhook`
     (use `stripe listen --forward-to localhost:3000/api/stripe/webhook` for
     local development)
   - Events to send:
     - `checkout.session.completed`
     - `checkout.session.async_payment_succeeded`
     - `payment_intent.succeeded`
   - Copy the endpoint's **Signing secret** → `STRIPE_WEBHOOK_SECRET`

   Inline payments (parent signs and pays on the sign page) are still
   re-verified server-side from the saved `payment_intent_id`; the webhook is
   idempotent and a no-op when `paid_at` is already set.

---

## 3. Resend setup (`contracts@studycore.net`)

1. Create a Resend account at [resend.com](https://resend.com).
2. **Domains → Add domain → `studycore.net`** (the root domain, not the
   subdomain — that lets you send from any address on it).
3. Resend will give you a list of DNS records to add at your DNS provider:
   - 1 × `MX` (return-path)
   - 2 × `TXT` SPF + DKIM
   - 1 × `TXT` DMARC (recommended)
4. Add those records, then click **Verify**. Once green you can send from any
   `*@studycore.net` address. This app sends from
   `StudyCore <contracts@studycore.net>` (set in `src/lib/email.ts`).
5. **API Keys → Create API key** → copy into `RESEND_API_KEY`.
6. (Optional but recommended) In Resend → Settings → set up an inbound forward
   for `contracts@studycore.net` so parent replies land somewhere a human reads.

The app sends three emails:
- **To parent on creation** — branded contract link with student summary and
  amount due.
- **To parent on completion** — confirmation with signed PDF attached.
- **To admin (`contracts@studycore.net`) + the closer** — signed notification
  with PDF attached.

---

## 4. Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New… → Project → Import** the repo.
3. Framework: Next.js (auto-detected). Build & install commands: defaults.
4. **Environment Variables** — add all seven from `.env.example` for the
   **Production**, **Preview**, and **Development** environments.
   - For local previews, set `NEXT_PUBLIC_APP_URL=https://sign.studycore.net`
     in production. For preview deployments you can leave it as the Vercel
     preview URL.
5. Deploy.

> The `/api/sign` route uses `@react-pdf/renderer` and runs on the Node.js
> runtime (already configured via `export const runtime = "nodejs"`). It works
> on Vercel's default function runtime — no extra config required.

---

## 5. Point `sign.studycore.net` at Vercel

In Vercel:
1. Project → **Settings → Domains → Add** → `sign.studycore.net`.
2. Vercel will display either a `CNAME` or `A` record to add at your DNS
   provider. Typically:
   - **Type**: `CNAME`
   - **Name / host**: `sign`
   - **Value / target**: `cname.vercel-dns.com`
   - **TTL**: default
3. At your DNS provider (Cloudflare / GoDaddy / Namecheap / Squarespace —
   wherever `studycore.net` is registered), add that record. If using Cloudflare
   proxy, set it to **DNS only** (gray cloud) to avoid double-proxying.
4. Wait for propagation (usually < 5 min). Vercel will issue an SSL cert
   automatically once the record resolves. Status will flip to "Valid
   Configuration".
5. Update `NEXT_PUBLIC_APP_URL` env var to `https://sign.studycore.net` and
   redeploy.

That's it — `sign.studycore.net` is live.

---

## App map

| Route                         | Who         | Purpose                                  |
| ----------------------------- | ----------- | ---------------------------------------- |
| `/`                           | Public      | Landing → Sign in                        |
| `/login`                      | Public      | Email/password sign-in for admin/closer  |
| `/admin`                      | Admin       | All contracts dashboard                  |
| `/admin/users`                | Admin       | Create / activate / deactivate closers   |
| `/admin/contracts/[id]`       | Admin       | Full contract details                    |
| `/closer`                     | Closer      | Their own contracts                      |
| `/closer/new`                 | Closer      | Contract creation form                   |
| `/closer/contracts/[id]`      | Closer      | View their contract                      |
| `/sign/[token]`               | Public link | Parent reviews, signs, and pays          |
| `/welcome`                    | Public      | Post-signing branded confirmation        |
| `/api/contracts` (POST)       | Closer      | Create + email contract                  |
| `/api/sign` (POST)            | Public      | Verify payment, store PDF, send emails   |
| `/api/admin/closers` (POST)   | Admin       | Create closer account                    |
| `/api/admin/closers/[id]`     | Admin       | Activate / deactivate                    |
| `/logout`                     | Auth user   | Sign out                                 |

---

## Brand logo

The signing page (and other surfaces that import `@/components/StudyCoreLogo`)
load the brand mark from one of two sources, in priority order:

1. `NEXT_PUBLIC_LOGO_URL` env var, if set — useful for pointing at a hosted
   asset on `studycore.net` or a CDN without redeploying just to swap the file.
2. Otherwise, `/studycore-logo.svg` from the `public/` folder.

To install the real StudyCore logo, replace `public/studycore-logo.svg` with
the actual SVG (or PNG — just rename and update the import in
`src/components/StudyCoreLogo.tsx` if extension changes). Or, simply set:

```
NEXT_PUBLIC_LOGO_URL=https://studycore.net/path/to/logo.svg
```

in your Vercel project's environment variables and redeploy. The placeholder
included in the repo is a clean wordmark in StudyCore navy/orange.

## Editing the contract text

All clauses live in [`src/lib/contract-text.ts`](./src/lib/contract-text.ts) as
structured data. Both the on-screen contract (signing page) and the generated
PDF render from the same source — change it in one place.

The PDF layout is in [`src/lib/pdf/ContractDocument.tsx`](./src/lib/pdf/ContractDocument.tsx).

---

## Security notes

- The signing page is intentionally public-by-token — there is no parent login.
  The token is 64 hex chars (`pgcrypto`-generated) and unique per contract.
- Service-role Supabase access is only used in server-side route handlers
  (`/api/*`) and never exposed to the client.
- Stripe payment is confirmed both client-side (UX) and server-side (auth) by
  re-fetching the `PaymentIntent` before marking the contract complete.
- Closers can only read/write their own contracts (RLS); admins see everything.
