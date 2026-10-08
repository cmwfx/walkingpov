import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CONTACT_INFO, cn } from '@/lib/utils';

const questions: { question: string; answer: ReactNode }[] = [
  { question: 'What do I get with Premium?', answer: <p>One-time $30 lifetime access to full-video downloads from the CandidFan Premium library.</p> },
  { question: 'Can I preview videos before paying?', answer: <p>Where a preview is available, you can watch the first 10 seconds for free. Videos without a processed preview continue to show their thumbnail.</p> },
  { question: 'How do I buy and submit the gift-card code?', answer: <p>Sign in to your CandidFan account, open the payment page, buy a $30 REWARBLE VISA gift card, then enter its code and select Submit gift-card code.</p> },
  { question: 'How long does payment review take?', answer: <p>Gift-card submissions are reviewed {CONTACT_INFO.reviewTime}. We email you when the review is complete; if approved, Premium access is activated on your account.</p> },
  { question: 'What if my payment is pending or I have a problem?', answer: <p>Do not submit the code again while your payment is under review. If your code is rejected or you need help, <Link to="/support" className="font-medium text-primary underline underline-offset-4">open a private support ticket</Link> while signed in, or email <a href={`mailto:${CONTACT_INFO.email}`} className="font-medium text-primary underline underline-offset-4">{CONTACT_INFO.email}</a>.</p> },
  { question: 'Can I get a refund?', answer: <p>Refund requests for CandidFan access are considered case by case. The gift card is purchased through an external retailer, so refunds for the card purchase follow that retailer's policy.</p> },
];

export function PremiumFaq({ className }: { className?: string }) {
  return (
    <section aria-label="Premium and payment frequently asked questions" className={cn('rounded-xl border border-border bg-card/60 p-5 text-card-foreground', className)}>
      <h2 className="text-lg font-semibold">Frequently asked questions</h2>
      <div className="mt-2 divide-y divide-border">
        {questions.map(({ question, answer }) => (
          <details key={question} className="group py-3 first:pt-0 last:pb-0">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-left font-medium focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
              <span>{question}</span>
              <ChevronDown aria-hidden="true" className="mt-0.5 size-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="pt-2 text-sm leading-6 text-muted-foreground">{answer}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
