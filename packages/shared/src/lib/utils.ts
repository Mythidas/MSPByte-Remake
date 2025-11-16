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

export function clipText(input: string | null | undefined, length: number) {
    if (!input) return '';

    if (input.length >= length) {
        return input.substring(0, length) + '...';
    }

    return input;
}

export function genSUUID(length = 8) {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let out = '';
    for (let i = 0; i < length; i++) {
        out += chars[bytes[i] % chars.length];
    }
    return out;
}
