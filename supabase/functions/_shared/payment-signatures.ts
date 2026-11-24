const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqualHex(actual: string, expected: string): boolean {
  const a = hexToBytes(actual);
  const b = hexToBytes(expected);
  if (!a || !b || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

async function hmacHex(
  algorithm: "SHA-256" | "SHA-512",
  secret: string,
  message: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return bytesToHex(new Uint8Array(digest));
}

function rawPaymobValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function getPath(source: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = source;
  for (const part of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Verifies the Paymob Accept Transaction Processed callback.
 * Null/missing signed fields fail closed until the merchant's actual callback
 * shape has been confirmed for the enabled payment method.
 */
export async function verifyPaymobTransactionHmac(
  callback: Record<string, unknown>,
  suppliedHmac: string,
  secret: string,
): Promise<boolean> {
  if (!secret || !suppliedHmac || !/^[0-9a-f]{128}$/i.test(suppliedHmac)) {
    return false;
  }

  const obj = callback.obj;
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const transaction = obj as Record<string, unknown>;
  const fields: string[][] = [
    ["amount_cents"],
    ["created_at"],
    ["currency"],
    ["error_occured"],
    ["has_parent_transaction"],
    ["id"],
    ["integration_id"],
    ["is_3d_secure"],
    ["is_auth"],
    ["is_capture"],
    ["is_refunded"],
    ["is_standalone_payment"],
    ["is_voided"],
    ["order", "id"],
    ["owner"],
    ["pending"],
    ["source_data", "pan"],
    ["source_data", "sub_type"],
    ["source_data", "type"],
    ["success"],
  ];

  const values: string[] = [];
  for (const path of fields) {
    const value = rawPaymobValue(getPath(transaction, path));
    if (value === null) return false;
    values.push(value);
  }

  const computed = await hmacHex("SHA-512", secret, values.join(""));
  return constantTimeEqualHex(computed, suppliedHmac);
}

function formatFawryMoney(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

function optionalText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}

/**
 * Verifies FawryPay Server-to-Server Notification V2 messageSignature.
 * Uses the documented field spelling paymentRefrenceNumber.
 */
export async function verifyFawryNotificationV2(
  payload: Record<string, unknown>,
  secret: string,
): Promise<boolean> {
  const supplied = payload.messageSignature;
  if (
    !secret ||
    typeof supplied !== "string" ||
    !/^[0-9a-f]{64}$/i.test(supplied)
  ) return false;

  const fawryRef = optionalText(payload.fawryRefNumber);
  const merchantRef = optionalText(payload.merchantRefNumber);
  const paymentAmount = formatFawryMoney(payload.paymentAmount);
  const orderAmount = formatFawryMoney(payload.orderAmount);
  const orderStatus = optionalText(payload.orderStatus);
  const paymentMethod = optionalText(payload.paymentMethod);
  const paymentReference = optionalText(payload.paymentRefrenceNumber);

  if (
    !fawryRef || !merchantRef || paymentAmount === null ||
    orderAmount === null || !orderStatus || !paymentMethod
  ) return false;

  const signedText = [
    fawryRef,
    merchantRef,
    paymentAmount,
    orderAmount,
    orderStatus,
    paymentMethod,
    paymentReference,
    secret,
  ].join("");

  const computed = await hmacHex("SHA-256", secret, signedText);
  return constantTimeEqualHex(computed, supplied);
}
