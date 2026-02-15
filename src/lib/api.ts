import { API_URL } from './utils';
import { supabase } from './supabase';

let csrfToken: string | null = null;

/**
 * Fetches CSRF token from the server
 */
async function getCsrfToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }

  try {
    const response = await fetch(`${API_URL}/api/csrf-token`, {
      credentials: 'include', // Important: include cookies
    });

    if (!response.ok) {
      throw new Error('Failed to fetch CSRF token');
    }

    const data = await response.json();
    const token = data.csrfToken || '';
    csrfToken = token;
    return token;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    throw error;
  }
}

export async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const csrf = await getCsrfToken();

  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrf,
  };
}

export async function uploadThumbnail(file: File): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const csrf = await getCsrfToken();
  const formData = new FormData();
  formData.append('thumbnail', file);

  const response = await fetch(`${API_URL}/api/upload/thumbnail`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'X-CSRF-Token': csrf,
    },
    credentials: 'include', // Important: include cookies
    body: formData
  });

  if (!response.ok) {
    throw new Error('Failed to upload thumbnail');
  }

  const data = await response.json();
  return `${API_URL}${data.url}`;
}

export async function getVideos(page: number = 1, tag?: string) {
  const url = new URL(`${API_URL}/api/videos`);
  url.searchParams.set('page', page.toString());
  if (tag) {
    url.searchParams.set('tag', tag);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Failed to fetch videos');
  }

  return response.json();
}

export async function getVideo(id: string) {
  const response = await fetch(`${API_URL}/api/videos/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch video');
  }

  return response.json();
}

export async function getDownloadLinks(videoId: string) {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/videos/${videoId}/downloads`, {
    headers
  });

  if (!response.ok) {
    throw new Error('Failed to fetch download links');
  }

  return response.json();
}

export async function createVideo(data: {
  title: string;
  thumbnail_url: string;
  tags: string[];
  download_links: { label: string; url: string }[];
}) {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/videos`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error('Failed to create video');
  }

  return response.json();
}

export async function bulkUploadFromJson(videos: any[]) {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/bulk-upload/json`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ videos })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to upload videos');
  }

  return response.json();
}

// Async bulk upload - Start job
export async function startBulkUpload(videos: any[]): Promise<{ jobId: string }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/bulk-upload/json/start`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ videos })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to start bulk upload');
  }

  return response.json();
}

// Get bulk upload job status
export interface BulkUploadJobStatus {
  id: string;
  totalVideos: number;
  processed: number;
  successful: number;
  failed: number;
  status: 'processing' | 'completed' | 'failed';
  errors: Array<{
    index: number;
    title: string;
    error: string;
  }>;
  startedAt: string;
  completedAt?: string;
}

export async function getBulkUploadStatus(jobId: string): Promise<BulkUploadJobStatus> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/bulk-upload/json/status/${jobId}`, {
    headers
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to get upload status');
  }

  return response.json();
}