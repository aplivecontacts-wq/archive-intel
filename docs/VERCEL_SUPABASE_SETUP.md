# Vercel & Supabase Setup — What to Add Where

Use this to copy env vars from your project into **Vercel** and to configure **Supabase** for production.

---

## 1. Vercel (Environment Variables)

In **Vercel** → your project → **Settings** → **Environment Variables**, add these.  
Copy the **value** from your `.env.local` (or use production values where noted).

| Variable | Where to get value | Environments |
|----------|--------------------|---------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Copy from .env.local (or Clerk Dashboard → Production) | Production, Preview |
| `CLERK_SECRET_KEY` | Copy from .env.local (or Clerk Dashboard → Production) | Production, Preview |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/login` | Production, Preview |
| `CLERK_SIGN_IN_URL` | `/login` | Production, Preview |
| `SUPABASE_URL` | Copy from .env.local (Supabase project URL) | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Copy from .env.local (Supabase → Settings → API → service_role) | Production, Preview |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Copy from .env.local (or Stripe live key for production) | Production, Preview |
| `STRIPE_SECRET_KEY` | Copy from .env.local (or Stripe live key for production) | Production, Preview |
| `STRIPE_PRICE_BASIC` | Copy from .env.local | Production, Preview |
| `STRIPE_PRICE_PRO` | Copy from .env.local | Production, Preview |
| `NEXT_PUBLIC_APP_URL` | **Set to your Vercel URL**, e.g. `https://your-app.vercel.app` | Production |
| `STRIPE_WEBHOOK_SECRET` | **New secret** from Stripe Dashboard (create webhook for `https://your-app.vercel.app/api/webhooks/stripe`) | Production |
| `OPENAI_API_KEY` | Copy from .env.local | Production, Preview |

**Important for production**

- For **production**, use Stripe **live** keys and a Stripe webhook pointing to `https://your-app.vercel.app/api/webhooks/stripe` (or `/api/stripe/webhook` if that’s the one you use).
- Set `NEXT_PUBLIC_APP_URL` to your real Vercel URL so redirects and links work.

---

## 2. Supabase (Configuration)

Your app talks to Supabase from the server using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Those are set in **Vercel** (above). You don’t paste them “into” Supabase.

In **Supabase** do the following:

1. **Authentication (if you use Supabase Auth)**  
   **Authentication** → **URL configuration**  
   - **Site URL**: your Vercel URL, e.g. `https://your-app.vercel.app`  
   - **Redirect URLs**: add `https://your-app.vercel.app/**` (and `http://localhost:3000/**` for local)

2. **API keys (already in .env.local)**  
   **Settings** → **API**  
   - **Project URL** → use as `SUPABASE_URL` in Vercel  
   - **service_role** (secret) → use as `SUPABASE_SERVICE_ROLE_KEY` in Vercel  
   - **anon** (public) → only needed if you add client-side Supabase (e.g. `NEXT_PUBLIC_SUPABASE_ANON_KEY`) later

3. **Database**  
   Migrations are run from your machine or CI with `SUPABASE_DB_URL` or `DATABASE_URL` (connection string from Supabase → Settings → Database). You do **not** put this in Vercel env for the Next.js app unless you run migrations from the app.

---

## 3. Quick copy (Vercel only)

Variable **names** to add in Vercel (paste values from .env.local or dashboards):

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL
CLERK_SIGN_IN_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_PRICE_BASIC
STRIPE_PRICE_PRO
NEXT_PUBLIC_APP_URL
STRIPE_WEBHOOK_SECRET
OPENAI_API_KEY
```

Set `NEXT_PUBLIC_APP_URL` to your Vercel URL and create a new `STRIPE_WEBHOOK_SECRET` for the production webhook URL.
