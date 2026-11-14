export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(path: string, options: RequestInit & { body?: any } = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...rest,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Network unavailable. Your report can still be queued offline.', 0);
  }
  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    throw new ApiError(payload?.error || `Request failed (${response.status})`, response.status);
  }
  return payload as T;
}

export const get = <T = any>(path: string) => api<T>(path);
export const post = <T = any>(path: string, body?: any) => api<T>(path, { method: 'POST', body: body ?? {} });
export const patch = <T = any>(path: string, body?: any) => api<T>(path, { method: 'PATCH', body: body ?? {} });
export const del = <T = any>(path: string) => api<T>(path, { method: 'DELETE' });

export const SINGULAR: Record<string, string> = {
  incidents: 'incident',
  teams: 'team',
  hospitals: 'hospital',
  resources: 'resource',
  broadcasts: 'broadcast',
  users: 'user',
};

export const ENDPOINTS: Record<string, string> = {
  incidents: '/incidents?limit=300',
  teams: '/teams',
  hospitals: '/hospitals',
  resources: '/resources',
  broadcasts: '/broadcasts',
  users: '/users',
  activity: '/activity',
  notifications: '/notifications',
  analytics: '/analytics',
  settings: '/settings',
};
