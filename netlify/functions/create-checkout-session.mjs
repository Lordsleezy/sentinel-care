import Stripe from 'stripe';
import { json } from './_shared.mjs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  try {
    const { plan } = JSON.parse(event.body || '{}');
    const price = plan === 'plus' ? process.env.STRIPE_PLUS_PRICE_ID : process.env.STRIPE_BASIC_PRICE_ID;
    if (!price) return json(400, { error: 'Stripe price ID is not configured.' });

    const siteUrl = process.env.SITE_URL || 'https://care.sentinelprime.org';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      success_url: `${siteUrl}/portal.html?checkout=success`,
      cancel_url: `${siteUrl}/checkout.html?plan=${plan || 'basic'}&checkout=cancelled`,
      metadata: { plan: plan === 'plus' ? 'plus' : 'basic' },
      subscription_data: { metadata: { plan: plan === 'plus' ? 'plus' : 'basic' } }
    });

    return json(200, { url: session.url });
  } catch (error) {
    return json(400, { error: error.message });
  }
}
