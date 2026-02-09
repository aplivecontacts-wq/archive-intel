import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { supabaseServer } from '@/lib/supabase-server';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key);
}

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'Missing Stripe webhook configuration' },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const clerkUserId = (session.metadata?.clerk_user_id || session.metadata?.userId) as string | undefined;
    const tier = session.metadata?.tier as string | undefined;

    if (!clerkUserId) {
      console.error('Missing clerk_user_id/userId in checkout.session.completed', { metadata: session.metadata });
      return NextResponse.json({ received: true });
    }
    const plan = tier === 'monthly' || tier === 'yearly' || tier === 'basic' || tier === 'pro' ? 'pro' : 'free';

    const { error } = await (supabaseServer.from('user_tiers') as any)
      .upsert(
        {
          user_id: clerkUserId,
          tier: plan,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Failed to upsert user_tiers:', error);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
