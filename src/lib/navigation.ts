/** Return only same-site paths so CTA redirects cannot become open redirects. */
export function getSafeReturnTo(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;

  const path = value.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return fallback;

  return path;
}
