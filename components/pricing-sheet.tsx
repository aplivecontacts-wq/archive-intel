'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Crown, Loader2 } from 'lucide-react';

type Plan = 'free' | 'pro';

interface PricingSheetProps {
  trigger?: React.ReactNode;
}

export function PricingSheet({ trigger }: PricingSheetProps) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<Plan>('free');
  const [loading, setLoading] = useState(false);
  const [checkoutTier, setCheckoutTier] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch('/api/tier')
      .then((res) => res.ok && res.json())
      .then((data) => {
        const t = data?.tier;
        setPlan(t === 'pro' || t === 'basic' ? 'pro' : 'free');
      })
      .catch(() => {});
  }, [open]);

  const handleCheckout = async (t: 'monthly' | 'yearly') => {
    setCheckoutTier(t);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: t } as { tier: 'monthly' | 'yearly' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error(err);
      setCheckoutTier(null);
      alert(err instanceof Error ? err.message : 'Checkout failed');
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="w-full font-mono text-sm border-emerald-200 text-emerald-700 hover:bg-emerald-50">
            <Crown className="h-4 w-4 mr-2" />
            UPGRADE
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="bg-white border-emerald-200 w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-emerald-700 font-mono">PLANS</SheetTitle>
          <SheetDescription className="text-gray-600 font-mono text-sm">
            Monthly or yearly billing
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {plan === 'pro' && (
            <p className="text-sm text-emerald-700 font-mono">
              Current: <Badge variant="secondary" className="font-mono">Pro</Badge>
            </p>
          )}

          <div className="rounded-lg border border-emerald-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-emerald-600" />
                <span className="font-mono font-medium">Monthly — $29/mo</span>
              </div>
              {plan === 'pro' ? (
                <Badge className="bg-emerald-100 text-emerald-800">Current</Badge>
              ) : (
                <Button
                  size="sm"
                  className="font-mono bg-emerald-600 hover:bg-emerald-700"
                  disabled={loading || checkoutTier !== null}
                  onClick={() => handleCheckout('monthly')}
                >
                  {checkoutTier === 'monthly' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upgrade'}
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-lg border-2 border-emerald-300 p-4 space-y-3 bg-emerald-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-emerald-600" />
                <span className="font-mono font-medium">Yearly — $299/yr</span>
              </div>
              {plan === 'pro' ? (
                <Badge className="bg-emerald-100 text-emerald-800">Current</Badge>
              ) : (
                <Button
                  size="sm"
                  className="font-mono bg-emerald-600 hover:bg-emerald-700"
                  disabled={loading || checkoutTier !== null}
                  onClick={() => handleCheckout('yearly')}
                >
                  {checkoutTier === 'yearly' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upgrade'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
