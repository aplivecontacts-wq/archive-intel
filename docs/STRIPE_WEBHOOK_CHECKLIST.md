# Stripe + Webhook Sanity Checks

## Environment Variables (Required)

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Server-side Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification (different for local vs prod) |
| `STRIPE_PRICE_MONTHLY` | $29/month recurring price ID |
| `STRIPE_PRICE_YEARLY` | $299/year recurring price ID |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | (Optional) Client-side Stripe.js |
| `NEXT_PUBLIC_APP_URL` | Base URL for success/cancel redirects |

**Note:** Free plan has NO Stripe price. Only Pro (monthly/yearly) uses Stripe.

## Webhook Endpoint

- **Path:** `POST /api/stripe/webhook`
- **Full URL (prod):** `https://archive-intel.vercel.app/api/stripe/webhook`

## Events Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Upsert `user_tiers` with `plan=pro` |
| `customer.subscription.created` | Upsert `user_tiers` with `plan=pro` if active/trialing |
| `customer.subscription.updated` | Update `user_tiers` (pro if active/trialing, free otherwise) |
| `customer.subscription.deleted` | Set `plan=free` |

## Plan Mapping

- **active, trialing** → `plan=pro`
- **canceled, unpaid, incomplete_expired, past_due** → `plan=free`

## Quick Test (Stripe Dashboard)

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Select your endpoint
3. Click **Send test webhook**
4. Choose `checkout.session.completed` (or `customer.subscription.updated`)
5. Verify your app receives it (check Vercel logs or local terminal)
6. Confirm `user_tiers` row is created/updated in Supabase

## Local Testing

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use the printed `whsec_...` as `STRIPE_WEBHOOK_SECRET` in `.env.local`.

## Metadata Requirement

Checkout sessions and subscriptions must include `metadata.clerk_user_id` for entitlement mapping. The checkout route sets this automatically.
