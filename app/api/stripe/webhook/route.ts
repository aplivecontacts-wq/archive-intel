import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { supabaseServer } from '@/lib/supabase-server';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key);
}

const PRO_STATUSES = new Set(['active', 'trialing']);
const FREE_STATUSES = new Set(['canceled', 'unpaid', 'incomplete_expired', 'past_due']);

async function upsertEntitlement(clerkUserId: string, plan: 'free' | 'pro', stripeCustomerId?: string) {
  const { error } = await (supabaseServer.from('user_tiers') as any).upsert(
    {
      user_id: clerkUserId,
      tier: plan,
      ...(stripeCustomerId && { stripe_customer_id: stripeCustomerId }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) {
    console.error('Failed to upsert user_tiers:', error);
    throw error;
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing Stripe webhook configuration' }, { status: 500 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkUserId = session.metadata?.clerk_user_id as string | undefined;
        if (!clerkUserId) {
          console.error('checkout.session.completed: missing clerk_user_id in metadata', session.metadata);
          break;
        }
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        if (session.subscription && session.mode === 'subscription') {
          await upsertEntitlement(clerkUserId, 'pro', customerId);
        } else if (session.payment_status === 'paid') {
          await upsertEntitlement(clerkUserId, 'pro', customerId);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const clerkUserId = subscription.metadata?.clerk_user_id as string | undefined;
        if (!clerkUserId) {
          console.error(`${event.type}: missing clerk_user_id in subscription metadata`, subscription.metadata);
          break;
        }
        const plan = PRO_STATUSES.has(subscription.status) ? 'pro' : 'free';
        await upsertEntitlement(clerkUserId, plan, subscription.customer as string);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const clerkUserId = subscription.metadata?.clerk_user_id as string | undefined;
        if (!clerkUserId) {
          console.error('customer.subscription.deleted: missing clerk_user_id', subscription.metadata);
          break;
        }
        await upsertEntitlement(clerkUserId, 'free');
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
