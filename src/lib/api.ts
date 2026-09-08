import { supabase } from './supabase';
import { API_URL } from './utils';

let csrfToken: string | null = null;

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API_URL}/api/csrf-token`, { credentials: 'include' });
  if (!response.ok) throw new Error('Unable to start a secure request.');
  csrfToken = (await response.json()).csrfToken || null;
  if (!csrfToken) throw new Error('Unable to start a secure request.');
  return csrfToken;
}

async function authHeaders(mutate = false) {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error('Please sign in to continue.');
  return {
    Authorization: `Bearer ${data.session.access_token}`,
    ...(mutate ? { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrfToken() } : {}),
  };
}

async function request<T>(pathname: string, init: RequestInit = {}, authenticated = false): Promise<T> {
  const mutate = Boolean(init.method && !['GET', 'HEAD', 'OPTIONS'].includes(init.method));
  const headers = { ...(init.headers || {}), ...(authenticated ? await authHeaders(mutate) : mutate ? { 'Content-Type': 'application/json', 'X-CSRF-Token': await getCsrfToken() } : {}) };
  const response = await fetch(`${API_URL}${pathname}`, { ...init, headers, credentials: 'include' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Request failed.');
  return body as T;
}

export const getMe = () => request<{ user: import('./supabase').User }>('/api/me', {}, true);
export const getVideos = (page = 1, tag = '') => request<{ videos: import('./supabase').Video[]; pagination: { page: number; total: number; totalPages: number } }>(`/api/videos?page=${page}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`);
export const getVideo = (id: string) => request<import('./supabase').Video>(`/api/videos/${encodeURIComponent(id)}`);
export const getDownloadUrl = (id: string) => request<{ url: string; expires_at: string }>(`/api/videos/${encodeURIComponent(id)}/download`, {}, true);
export async function updateVideoThumbnail(id: string, file: File) {
  const form = new FormData();
  form.append('thumbnail', file, 'thumbnail');
  const headers = { ...(await authHeaders(false)), 'X-CSRF-Token': await getCsrfToken() };
  const response = await fetch(`${API_URL}/api/admin/videos/${encodeURIComponent(id)}/thumbnail`, {
    method: 'POST',
    headers,
    body: form,
    credentials: 'include',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to update the video thumbnail.');
  return body as { thumbnail_url: string };
}
export const setVideoFeatured = (id: string, is_featured: boolean) => request<{ is_featured: boolean }>(`/api/admin/videos/${encodeURIComponent(id)}/featured`, { method: 'POST', body: JSON.stringify({ is_featured }) }, true);
export const submitPayment = (proof: string) => request('/api/payments/submit', { method: 'POST', body: JSON.stringify({ proof }) }, true);
export const getPaymentRequests = () => request<import('./supabase').PaymentRequest[]>('/api/payments/requests', {}, true);
export const reviewPayment = (id: string, decision: 'approved' | 'denied', notes: string) => request(`/api/payments/${id}/review`, { method: 'POST', body: JSON.stringify({ decision, notes }) }, true);
export const getAdminStats = () => request<{ total_videos: number; total_users: number; pending_payments: number; premium_users: number; unread_support: number }>('/api/admin/stats', {}, true);
export const getTickets = () => request<import('./supabase').SupportTicket[]>('/api/support', {}, true);
export const createTicket = (subject: string, body: string) => request<{ id: string }>('/api/support', { method: 'POST', body: JSON.stringify({ subject, body }) }, true);
export const getTicket = (id: string) => request<import('./supabase').SupportTicket & { messages: import('./supabase').SupportMessage[] }>(`/api/support/${encodeURIComponent(id)}`, {}, true);
export const replyTicket = (id: string, body: string, notifyEmail = false) => request(`/api/support/${encodeURIComponent(id)}/messages`, { method: 'POST', body: JSON.stringify({ body, notify_email: notifyEmail }) }, true);
export const setTicketStatus = (id: string, status: 'open' | 'closed') => request(`/api/support/${encodeURIComponent(id)}/status`, { method: 'POST', body: JSON.stringify({ status }) }, true);
export const getAdminTickets = () => request<import('./supabase').SupportTicket[]>('/api/admin/support', {}, true);
export const getImportJobs = () => request<import('./supabase').ImportJob[]>('/api/import/admin/jobs', {}, true);
export const startImport = () => request<import('./supabase').ImportJob>('/api/import/admin/jobs', { method: 'POST', body: '{}' }, true);
export const resumeImport = (id: string) => request(`/api/import/admin/jobs/${encodeURIComponent(id)}/resume`, { method: 'POST', body: '{}' }, true);
