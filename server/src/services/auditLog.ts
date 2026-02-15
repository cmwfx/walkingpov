import { supabaseAdmin } from '../config/supabase.js';
import { Request } from 'express';

export interface AuditLogEntry {
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Logs an admin action to the audit log table
 */
export async function logAuditAction(
  userId: string,
  action: string,
  resourceType: string,
  req?: Request,
  details?: any,
  resourceId?: string
): Promise<void> {
  try {
    const ipAddress = req ? (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress
    ) : undefined;

    const userAgent = req?.headers['user-agent'];

    const auditEntry = {
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details: details ? JSON.stringify(details) : null,
      ip_address: ipAddress,
      user_agent: userAgent,
      timestamp: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from('audit_logs')
      .insert(auditEntry);

    if (error) {
      console.error('Failed to log audit action:', error);
      // Don't throw - we don't want audit logging failures to break the main action
    }
  } catch (error) {
    console.error('Error in audit logging:', error);
  }
}

/**
 * Retrieves audit logs with optional filters
 */
export async function getAuditLogs(filters?: {
  userId?: string;
  action?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  try {
    let query = supabaseAdmin
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false });

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters?.action) {
      query = query.eq('action', filters.action);
    }

    if (filters?.resourceType) {
      query = query.eq('resource_type', filters.resourceType);
    }

    if (filters?.startDate) {
      query = query.gte('timestamp', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('timestamp', filters.endDate);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    } else {
      query = query.limit(100); // Default limit
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    throw error;
  }
}
