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

export function generateUUID(sentinel?: boolean): string {
  if (sentinel) return "00000000-0000-0000-0000-000000000000";

  // Use browser crypto API if available
  if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }

  // Use Node.js crypto if available (server-side)
  if (typeof window === "undefined") {
    try {
      const { randomUUID } = require("node:crypto");
      return randomUUID();
    } catch {
      // Fallback if node:crypto is not available
    }
  }

  // Fallback implementation
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generatePassword(length: number = 12): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()?+";
  let password = "";

  // Use browser crypto API if available
  if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);

    for (let i = 0; i < length; i++) {
      password += chars[array[i]! % chars.length];
    }
    return password;
  }

  // Use Node.js crypto if available (server-side)
  if (typeof window === "undefined") {
    try {
      const { getRandomValues } = require("node:crypto");
      const array = new Uint32Array(length);
      getRandomValues(array);

      for (let i = 0; i < length; i++) {
        password += chars[array[i]! % chars.length];
      }
      return password;
    } catch {
      // Fallback if node:crypto is not available
    }
  }

  // Fallback implementation using Math.random()
  for (let i = 0; i < length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

export function isNextJS() {
  return typeof window !== "undefined" && (window as any).__NEXT_DATA__;
}
