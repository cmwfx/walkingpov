import { Check, Crown, Zap, Shield, Video, Infinity } from 'lucide-react';
export function PremiumBenefits({ className }: { className?: string }) {
  const benefits = [
    {
      icon: Infinity,
      us: "Lifetime access",
      others: "Monthly subscription",
      highlight: true
    },
    {
      icon: Video,
      us: "Full 720p streaming library",
      others: "Five-second previews",
      highlight: true
    },
    {
      icon: Crown,
      us: "One €50 lifetime payment",
      others: "Recurring subscriptions",
      highlight: true
    },
    {
      icon: Zap,
      us: "Secure playback links",
      others: "Unprotected file links",
      highlight: true
    },
    {
      icon: Shield,
      us: "Encrypted payment proof",
      others: "Plain-text payment storage",
      highlight: true
    }
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid gap-3">
        {benefits.map((benefit, index) => (
          <div 
            key={index}
            className="relative overflow-hidden rounded-lg bg-card/50 border p-3 text-sm transition-all hover:bg-accent/5"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="rounded-full bg-primary/10 p-2 shrink-0">
                  <benefit.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground flex items-center gap-2">
                    {benefit.us}
                  </span>
                  <span className="text-xs text-muted-foreground line-through opacity-70">
                    vs competitors {benefit.others}
                  </span>
                </div>
              </div>
              <div className="shrink-0">
                <Check className="h-4 w-4 text-green-500" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
