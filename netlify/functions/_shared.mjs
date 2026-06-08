import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

export function getAdminSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

export async function requireUser(event) {
  const token = event.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Missing authorization token.');
  const supabase = getAdminSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid session.');
  return { supabase, user: data.user };
}

export async function requireAdmin(event) {
  const context = await requireUser(event);
  if (context.user.email !== (process.env.ADMIN_EMAIL || 'paul@sentinelprime.org')) {
    throw new Error('Admin access required.');
  }
  return context;
}

export function currentCycleStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function planLimits(plan) {
  if (plan === 'plus') return { humanInteractions: 2, remoteSessions: 2 };
  if (plan === 'basic') return { humanInteractions: 1, remoteSessions: 1 };
  return { humanInteractions: 0, remoteSessions: 0 };
}

export async function getOrCreateCustomer(supabase, user) {
  const { data: existing } = await supabase.from('customers').select('*').eq('user_id', user.id).maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase.from('customers').insert({ user_id: user.id, email: user.email, name: user.user_metadata?.full_name || null }).select('*').single();
  if (error) throw error;
  return data;
}

export async function getActiveSubscription(supabase, customerId) {
  const { data } = await supabase.from('subscriptions').select('*').eq('customer_id', customerId).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data;
}

export async function getUsage(supabase, customerId) {
  const cycleStart = currentCycleStart();
  const { data } = await supabase.from('interactions').select('type').eq('customer_id', customerId).gte('created_at', cycleStart);
  const interactions = data || [];
  return {
    humanInteractions: interactions.filter((item) => ['ai_escalation', 'phone_callback', 'remote_session'].includes(item.type)).length,
    remoteSessions: interactions.filter((item) => item.type === 'remote_session').length,
    aiChats: interactions.filter((item) => item.type === 'ai_chat').length
  };
}

export async function sendSupportEmail(ticket, customer) {
  if (!process.env.RESEND_API_KEY) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.FROM_EMAIL || 'Sentinel Care <support@sentinelprime.org>',
    to: process.env.SUPPORT_NOTIFICATION_EMAIL || 'paul@sentinelprime.org',
    subject: `Sentinel Care support request: ${ticket.issue_summary}`,
    text: `Customer: ${customer.name || customer.email}\nEmail: ${customer.email}\nType: ${ticket.type}\nSummary: ${ticket.issue_summary}\nDetails: ${ticket.details || ''}\nCreated: ${ticket.created_at}`
  });
}
