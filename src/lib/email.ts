export function normalizeEmailAddress(value: string): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\p{Cf}\s\u00A0]/gu, '')
    .toLowerCase()
}

export function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(value)
}
