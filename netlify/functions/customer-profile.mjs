import { getActiveSubscription, getOrCreateCustomer, getUsage, json, planLimits, requireUser } from './_shared.mjs';

export async function handler(event) {
  try {
    const { supabase, user } = await requireUser(event);
    const customer = await getOrCreateCustomer(supabase, user);
    const subscription = await getActiveSubscription(supabase, customer.id);
    const usage = await getUsage(supabase, customer.id);
    return json(200, { customer, subscription, usage, limits: planLimits(subscription?.plan) });
  } catch (error) {
    return json(401, { error: error.message });
  }
}
