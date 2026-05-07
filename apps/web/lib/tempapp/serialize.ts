/**
 * Strip non-plain-object properties from libsql result rows so they can be
 * passed from Server Components to Client Components without the
 * "Only plain objects can be passed" error.
 */
export function toPlain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}
