import { PaymentBenefits } from './PaymentBenefits';
import { INSTANTVIDGRAB_CHECKOUT_ENABLED, MONTHLY_SUBSCRIPTIONS_ENABLED } from '@/lib/utils';

export function PremiumBenefits({className}: {className?: string}) {
  return <div className={className}><PaymentBenefits cardCheckoutEnabled={INSTANTVIDGRAB_CHECKOUT_ENABLED} tier={MONTHLY_SUBSCRIPTIONS_ENABLED ? 'monthly' : 'lifetime'} /></div>;
}
