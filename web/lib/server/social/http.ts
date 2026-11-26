/** The path segment right after `name`, e.g. pathAfter(req, 'members') for /api/v1/members/<id>/like. */
export function pathAfter(req: Request, name: string): string {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean)
  const i = parts.lastIndexOf(name)
  return i >= 0 ? decodeURIComponent(parts[i + 1] ?? '') : ''
}
