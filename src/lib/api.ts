import { API_URL } from './utils';
import { supabase } from './supabase';
import type { PaymentRequest, SupportMessage, SupportTicket, User, Video } from './supabase';

let csrfToken: string | null = null;

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch(API_URL + '/api/csrf-token', { credentials: 'include' });
  if (!response.ok) throw new Error('Unable to initialize secure session');
  csrfToken = (await response.json()).csrfToken;
  return csrfToken as string;
}

async function request<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (auth) {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error('Please sign in');
    headers.set('Authorization', 'Bearer ' + data.session.access_token);
  }
  if (init.method && init.method !== 'GET' && init.method !== 'HEAD') headers.set('X-CSRF-Token', await getCsrfToken());
  const response = await fetch(API_URL + path, { ...init, headers, credentials: 'include' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Request failed');
  return payload as T;
}

export async function getMe() { return request<{ user: User }>('/api/me', {}, true); }
export async function getVideos(page = 1, tag = '') { return request<{ videos: Video[]; pagination: { page: number; total: number; totalPages: number } }>('/api/videos?page=' + page + (tag ? '&tag=' + encodeURIComponent(tag) : '')); }
export async function getVideo(id: string) { return request<Video>('/api/videos/' + encodeURIComponent(id)); }
export async function getPlaybackUrl(id: string) { return request<{ url: string; expires_at: string; duration_seconds: number; mime_type: string }>('/api/videos/' + encodeURIComponent(id) + '/playback', { method: 'POST', body: '{}' }, true); }
export async function getOffer() { return request<{ amountMinor: number; currency: string; label: string; purchaseUrl: string }>('/api/payments/offer'); }
export async function submitPayment(proof: string) { return request<{ id: string; status: string }>('/api/payments/submit', { method: 'POST', body: JSON.stringify({ proof }) }, true); }
export async function getMyPayments() { return request<PaymentRequest[]>('/api/payments/mine', {}, true); }
export async function getAdminStats() { return request<any>('/api/admin/stats', {}, true); }
export async function getPaymentRequests() { return request<any[]>('/api/payments/admin/requests', {}, true); }
export async function reviewPayment(id: string, decision: 'approved' | 'denied', notes: string) { return request<any>('/api/payments/admin/requests/' + id + '/review', { method: 'POST', body: JSON.stringify({ decision, notes }) }, true); }
export async function getImportJobs() { return request<any[]>('/api/imports/admin/jobs', {}, true); }
export async function startImportJob() { return request<any>('/api/imports/admin/jobs', { method: 'POST', body: '{}' }, true); }
export async function updateImportJob(id: string, pause: boolean) { return request<any>('/api/imports/admin/jobs/' + id, { method: 'PATCH', body: JSON.stringify({ pause }) }, true); }
export async function retryImportJob(id: string) { return request<any>('/api/imports/admin/jobs/' + id + '/retry', { method: 'POST', body: '{}' }, true); }
export async function getTickets(admin = false) { return request<SupportTicket[]>('/api/support/' + (admin ? 'admin/' : '') + 'tickets', {}, true); }
export async function createTicket(subject: string, body: string) { return request<any>('/api/support/tickets', { method: 'POST', body: JSON.stringify({ subject, body }) }, true); }
export async function getTicket(id: string) { return request<SupportTicket & { messages: SupportMessage[] }>('/api/support/tickets/' + id, {}, true); }
export async function replyToTicket(id: string, body: string, sendEmail = false) { return request<any>('/api/support/tickets/' + id + '/messages', { method: 'POST', body: JSON.stringify({ body, send_email: sendEmail }) }, true); }
export async function updateTicket(id: string, status: 'open' | 'closed') { return request<any>('/api/support/tickets/' + id, { method: 'PATCH', body: JSON.stringify({ status }) }, true); }

// Compatibility shims for unused legacy screens while the route migration is
// completed; they do not expose downloads or JSON imports.
export async function getDownloadLinks() { return []; }
export async function uploadThumbnail() { throw new Error('Thumbnail uploads were replaced by the storage import worker'); }
export async function createVideo() { throw new Error('Manual video creation was replaced by the storage import worker'); }
export async function startBulkUpload() { throw new Error('JSON catalog imports are disabled for the fresh CandidFan catalog'); }
export async function getBulkUploadStatus() { throw new Error('JSON catalog imports are disabled for the fresh CandidFan catalog'); }
export type BulkUploadJobStatus = never;

