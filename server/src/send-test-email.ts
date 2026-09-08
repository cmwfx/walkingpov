import 'dotenv/config';
import { supabaseAdmin } from './config/supabase.js';
import { makeTestEmail, sendEmail } from './services/email.js';

const recipient = process.env.ADMIN_EMAIL;
if (!recipient) throw new Error('ADMIN_EMAIL is required');
const email = makeTestEmail();
await sendEmail({ to: recipient, ...email });
await supabaseAdmin.from('audit_logs').insert({ action: 'smtp_test_sent', resource_type: 'email', details: { label: 'authorized_test' } });
console.log('smtp-test-sent');
