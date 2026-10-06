import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CONTACT_INFO } from '@/lib/utils';

export function PaymentFaq({ cardCheckoutEnabled }: { cardCheckoutEnabled: boolean }) {
  const questions: { question: string; answer: ReactNode }[] = [
    { question: 'What does Premium include?', answer: <>Lifetime CandidFan Premium access to full-video downloads from the library.{cardCheckoutEnabled && ' Card checkout also includes lifetime InstantVidGrab access.'}</> },
    { question: 'Is this a subscription?', answer: <>No. This is a one-time purchase, with no recurring subscription. Lifetime access lasts for the operating lifetime of the service.</> },
    ...(cardCheckoutEnabled ? [{ question: 'What happens after I pay by card?', answer: <>You continue to secure checkout on InstantVidGrab. Once payment is confirmed, your CandidFan Premium activates automatically and you return to your dashboard. The final total is shown before you pay.</> }] : []),
    { question: 'How does gift-card payment work?', answer: <>Buy a €50 REWARBLE VISA gift card from the linked retailer, then submit its code here. Codes are reviewed manually {CONTACT_INFO.reviewTime}. We email you when the review is complete. Avoid submitting the same code again while it is under review.</> },
    { question: 'What if I need help or a refund?', answer: <>You can <Link to="/support" className="text-violet-300 underline underline-offset-4 hover:text-violet-200">open a private support ticket</Link> or email <a href={`mailto:${CONTACT_INFO.email}`} className="break-all text-violet-300 underline underline-offset-4 hover:text-violet-200">{CONTACT_INFO.email}</a>. Refund requests for CandidFan access are considered case by case. Gift-card purchases follow the external retailer’s refund policy.</> },
  ];
  return (
    <section aria-labelledby="payment-faq-heading" className="border-t border-white/10 pt-8">
      <h2 id="payment-faq-heading" className="text-xl font-semibold tracking-tight text-white">A few things you might be wondering</h2>
      <div className="mt-4 divide-y divide-white/10">
        {questions.map(({ question, answer }) => (
          <details key={question} className="group py-1">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-3 text-sm font-medium text-slate-200 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-violet-400 [&::-webkit-details-marker]:hidden">
              {question}<ChevronDown aria-hidden="true" className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <p className="pb-4 text-sm leading-6 text-slate-400">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
