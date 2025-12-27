/**
 * Get nested value from object using dot notation
 * @example getNestedValue({ user: { name: 'John' } }, 'user.name') => 'John'
 */
export function getNestedValue(obj: any, path: string): any {
  if (!path || !obj) return undefined;
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

/**
 * Set nested value in object using dot notation
 * @example setNestedValue({}, 'user.name', 'John') => { user: { name: 'John' } }
 */
export function setNestedValue(obj: any, path: string, value: any): void {
  const parts = path.split(".");
  const last = parts.pop()!;
  const target = parts.reduce((acc, part) => {
    if (!(part in acc)) acc[part] = {};
    return acc[part];
  }, obj);
  target[last] = value;
}
