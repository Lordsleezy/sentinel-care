import Stripe from 'stripe';
import { getAdminSupabase, json } from './_shared.mjs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export async function handler(event) {
  const signature = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return json(400, { error: `Webhook signature verification failed: ${error.message}` });
  }

  const supabase = getAdminSupabase();

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const customerEmail = session.customer_details?.email;
    const plan = session.metadata?.plan || 'basic';
    if (customerEmail) {
      const { data: customer } = await supabase.from('customers').upsert({
        email: customerEmail,
        stripe_customer_id: session.customer,
        name: session.customer_details?.name || null
      }, { onConflict: 'email' }).select('*').single();
      await supabase.from('subscriptions').upsert({
        customer_id: customer.id,
        stripe_subscription_id: session.subscription,
        plan,
        status: 'active',
        current_period_start: new Date().toISOString()
      }, { onConflict: 'stripe_subscription_id' });
    }
  }

  if (stripeEvent.type === 'customer.subscription.deleted' || stripeEvent.type === 'customer.subscription.updated') {
    const subscription = stripeEvent.data.object;
    await supabase.from('subscriptions').update({
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
    }).eq('stripe_subscription_id', subscription.id);
  }

  return json(200, { received: true });
}
