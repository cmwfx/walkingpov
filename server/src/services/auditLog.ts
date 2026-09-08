import { supabaseAdmin } from '../config/supabase.js';
import { Request } from 'express';

export async function logAuditAction(
  actorId: string,
  action: string,
  resourceType: string,
  _req?: Request,
  details: Record<string, unknown> = {},
  resourceId?: string,
): Promise<void> {
  return supabaseAdmin.from('audit_logs').insert({
    actor_id: actorId,
    action,
    resource_type: resourceType,
    resource_id: resourceId || null,
    details,
  }).then(() => undefined);
}
