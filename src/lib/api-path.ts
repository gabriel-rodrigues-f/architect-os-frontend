export const API_PREFIX = "/api/v1";

export function apiPath(resource: string): string {
  return `${API_PREFIX}${resource}`;
}

export function isApiUrl(url: string): boolean {
  return url.includes(API_PREFIX);
}
