# Stripe Setup (Pro Subscription)

## 1. Environment Variables

Add to `.env.local` and Vercel:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...   # or sk_live_... in production
STRIPE_WEBHOOK_SECRET=whsec_... # from stripe listen (local) or Dashboard (prod)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # optional, for Stripe.js

# Pro plan prices - recurring subscriptions ($29/mo, $299/yr)
STRIPE_PRICE_MONTHLY=price_...  # $29/month recurring
STRIPE_PRICE_YEARLY=price_...   # $299/year recurring

# Legacy names (fallback)
STRIPE_PRICE_BASIC=price_...    # same as MONTHLY
STRIPE_PRICE_PRO=price_...      # same as YEARLY

NEXT_PUBLIC_APP_URL=http://localhost:3000  # or https://archive-intel.vercel.app
```

**Free plan has NO Stripe price.** It is internal only.

## 2. Create Products in Stripe

1. [Stripe Dashboard → Products](https://dashboard.stripe.com/products)
2. Create **Archive Intel Pro**
3. Add two **recurring** prices:
   - $29/month → copy Price ID → `STRIPE_PRICE_MONTHLY`
   - $299/year → copy Price ID → `STRIPE_PRICE_YEARLY`

## 3. Webhook Configuration

**Endpoint URL:** `https://archive-intel.vercel.app/api/stripe/webhook`

**Events to select:**
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

**Local testing:**
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## 4. Supabase

Run the `user_tiers` migration if not done. See `supabase/migrations/20260208120000_create_user_tiers.sql`.

## 5. Sanity Checks

See [docs/STRIPE_WEBHOOK_CHECKLIST.md](./docs/STRIPE_WEBHOOK_CHECKLIST.md) for verification steps and test webhook usage.
