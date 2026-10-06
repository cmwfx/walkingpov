import { createHash } from 'node:crypto';

const measurementId = 'G-2G7MG61YH5';
const measurementProtocolEndpoint = 'https://www.google-analytics.com/mp/collect';
const requestTimeoutMs = 3000;
const clientIdPattern = /^[0-9]{1,20}\.[0-9]{1,20}$/;

type PurchaseParameters = {
  transaction_id: string;
  currency: 'EUR';
  value: 50;
  engagement_time_msec: 1;
  items: Array<{
    item_id: 'candidfan_lifetime_premium';
    item_name: 'CandidFan Lifetime Premium';
    price: 50;
    quantity: 1;
  }>;
};

export function isValidGa4ClientId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 80 && clientIdPattern.test(value);
}

export function isGa4Configured() {
  const apiSecret = process.env.MEASUREMENT_PROTOCOL_API?.trim() || '';
  return /^[A-Za-z0-9_-]{10,200}$/.test(apiSecret);
}

export function purchaseParameters(paymentRequestId: string): PurchaseParameters {
  const transactionId = `cf_${createHash('sha256').update(paymentRequestId).digest('hex').slice(0, 32)}`;
  return {
    transaction_id: transactionId,
    currency: 'EUR',
    value: 50,
    engagement_time_msec: 1,
    items: [{
      item_id: 'candidfan_lifetime_premium',
      item_name: 'CandidFan Lifetime Premium',
      price: 50,
      quantity: 1,
    }],
  };
}

export async function sendGa4Purchase(clientId: string, paymentRequestId: string) {
  const apiSecret = process.env.MEASUREMENT_PROTOCOL_API?.trim() || '';
  if (!isValidGa4ClientId(clientId) || !/^[A-Za-z0-9_-]{10,200}$/.test(apiSecret)) return false;

  const endpoint = new URL(measurementProtocolEndpoint);
  endpoint.searchParams.set('measurement_id', measurementId);
  endpoint.searchParams.set('api_secret', apiSecret);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        events: [{ name: 'purchase', params: purchaseParameters(paymentRequestId) }],
      }),
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    if (!response.ok) {
      console.error('ga4-purchase-delivery-failed');
      return false;
    }
    return true;
  } catch {
    // A GA outage must never roll back an already-approved membership.
    console.error('ga4-purchase-delivery-failed');
    return false;
  }
}
