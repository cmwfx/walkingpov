import { Download, Infinity as InfinityIcon, Sparkles, Video } from 'lucide-react';

export function PaymentBenefits({ cardCheckoutEnabled }: { cardCheckoutEnabled: boolean }) {
  const benefits = [
    { icon: Download, title: 'Full-video downloads', description: 'Save complete videos from the Premium library.' },
    { icon: Video, title: 'The full Premium library', description: 'Explore the collection and download the videos you want.' },
    { icon: InfinityIcon, title: 'Lifetime membership', description: 'One upgrade. No monthly bills or recurring subscription.' },
    ...(cardCheckoutEnabled ? [{ icon: Sparkles, title: 'InstantVidGrab included', description: 'Card checkout also includes lifetime InstantVidGrab access.' }] : []),
  ];
  return (
    <section aria-labelledby="payment-benefits-heading">
      <h2 id="payment-benefits-heading" className="text-xl font-semibold tracking-tight text-white sm:text-2xl">More to enjoy. Yours to download.</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {benefits.map(({ icon: Icon, title, description }) => (
          <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="mb-4 inline-flex rounded-xl border border-violet-400/15 bg-violet-400/10 p-2.5 text-violet-300"><Icon aria-hidden="true" className="size-5" /></div>
            <h3 className="font-semibold text-slate-100">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
