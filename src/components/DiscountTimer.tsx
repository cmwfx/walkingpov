import { useState, useEffect } from 'react';
import { Timer } from 'lucide-react';

export function DiscountTimer() {
  const [timeLeft, setTimeLeft] = useState({ hours: 19, minutes: 0, seconds: 0 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (val: number) => val.toString().padStart(2, '0');

  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-primary animate-pulse">
      <Timer className="h-4 w-4" />
      <span>
        Offer ends in: {formatTime(timeLeft.hours)}:{formatTime(timeLeft.minutes)}:{formatTime(timeLeft.seconds)}
      </span>
    </div>
  );
}
