import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@clerk/nextjs/server';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key);
}

// Pro plan: monthly $29, yearly $299. Free has no Stripe price.
const PRICE_IDS: Record<string, string> = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || process.env.STRIPE_PRICE_BASIC || '',
  yearly: process.env.STRIPE_PRICE_YEARLY || process.env.STRIPE_PRICE_PRO || '',
};

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tier } = await req.json();
    const priceId = PRICE_IDS[tier as string];

    if (!priceId) {
      return NextResponse.json(
        { error: 'Invalid tier. Use "monthly" or "yearly".' },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/app?success=true`,
      cancel_url: `${baseUrl}/app?canceled=true`,
      metadata: { tier, clerk_user_id: userId },
      subscription_data: { metadata: { clerk_user_id: userId } },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout failed' },
      { status: 500 }
    );
  }
}
