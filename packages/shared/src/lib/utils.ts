export function pascalCase(str: string) {
  return str.substring(0, 1).toUpperCase() + str.substring(1);
}

export function prettyText(input?: string | null): string {
  if (!input) return "";
  return input
    .replace(/[_-]+/g, " ") // Replace underscores and dashes with spaces
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize first letter of each word
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD") // optional: normalize accented characters
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]/g, "") // remove non-alphanumeric
    .trim();
}
