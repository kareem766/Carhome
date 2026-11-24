import { normalizeEgyptianPhone } from "./payment-intent.ts";

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

Deno.test("Egyptian mobile numbers are normalized to E.164", () => {
  assertEqual(normalizeEgyptianPhone("01012345678"), "+201012345678", "local format");
  assertEqual(normalizeEgyptianPhone("+201001234567"), "+201001234567", "international format");
  assertEqual(normalizeEgyptianPhone("01112345678"), "+201112345678", "Orange/Vodafone/Etisalat/WE mobile prefix");
});

Deno.test("invalid and landline numbers are rejected for Paymob billing", () => {
  assertEqual(normalizeEgyptianPhone("0223456789"), null, "landline");
  assertEqual(normalizeEgyptianPhone("123"), null, "too short");
});
