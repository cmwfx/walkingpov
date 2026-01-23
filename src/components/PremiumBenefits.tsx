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
      us: "Thousands of videos",
      others: "Limited content",
      highlight: true
    },
    {
      icon: Crown,
      us: "$50k+ worth of content",
      others: "$20 per video",
      highlight: true
    },
    {
      icon: Zap,
      us: "Request any video",
      others: "Multiple subscriptions",
      highlight: true
    },
    {
      icon: Shield,
      us: "No personal info collected",
      others: "Non-discrete payments",
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
