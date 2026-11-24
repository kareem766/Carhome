import {
  verifyFawryNotificationV2,
  verifyPaymobTransactionHmac,
} from "./payment-signatures.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("Paymob transaction HMAC accepts the documented ordered field set", async () => {
  const callback = {
    type: "TRANSACTION",
    obj: {
      amount_cents: 100,
      created_at: "2020-03-25T18:39:44.719228",
      currency: "EGP",
      error_occured: false,
      has_parent_transaction: false,
      id: 2556706,
      integration_id: 6741,
      is_3d_secure: true,
      is_auth: false,
      is_capture: false,
      is_refunded: false,
      is_standalone_payment: true,
      is_voided: false,
      order: { id: 4778239 },
      owner: 4705,
      pending: false,
      source_data: { pan: "2346", sub_type: "MasterCard", type: "card" },
      success: true,
    },
  };
  const expected =
    "2e13fb727a177d3312608cd42a61d56f0ef22311a789521aa6f6811e28c8b7dec8506bb911d9fe729f03407401f481421de1504293549c9ba17aa1e6f9eee15e";

  assert(
    await verifyPaymobTransactionHmac(
      callback,
      expected,
      "mycar-test-paymob-secret",
    ),
    "Expected valid Paymob HMAC to pass",
  );
  assert(
    !(await verifyPaymobTransactionHmac(
      callback,
      expected.slice(0, -1) + "0",
      "mycar-test-paymob-secret",
    )),
    "Modified Paymob HMAC must fail",
  );
});

Deno.test("Paymob transaction HMAC fails closed on null signed fields", async () => {
  const callback = {
    obj: {
      amount_cents: 100,
      created_at: "2020-03-25T18:39:44.719228",
      currency: "EGP",
      error_occured: false,
      has_parent_transaction: false,
      id: 2556706,
      integration_id: 6741,
      is_3d_secure: true,
      is_auth: false,
      is_capture: false,
      is_refunded: false,
      is_standalone_payment: true,
      is_voided: false,
      order: { id: 4778239 },
      owner: 4705,
      pending: false,
      source_data: { pan: null, sub_type: "MasterCard", type: "card" },
      success: true,
    },
  };
  assert(
    !(await verifyPaymobTransactionHmac(
      callback,
      "a".repeat(128),
      "mycar-test-paymob-secret",
    )),
    "Null Paymob fields must not be guessed or accepted",
  );
});

Deno.test("FawryPay Notification V2 signature verifies exact decimal formatting", async () => {
  const payload = {
    fawryRefNumber: "123456789",
    merchantRefNumber: "9990001234",
    paymentAmount: 10,
    orderAmount: "10.0",
    orderStatus: "PAID",
    paymentMethod: "CARD",
    paymentRefrenceNumber: "369552233",
    messageSignature:
      "82a779ea396b9245d0855ddb5f892db9beb759baf87cbd7bfd002910083f7e7f",
  };
  assert(
    await verifyFawryNotificationV2(payload, "mycar-test-fawry-secret"),
    "Expected valid FawryPay signature to pass",
  );
  assert(
    !(await verifyFawryNotificationV2(
      { ...payload, paymentAmount: 10.01 },
      "mycar-test-fawry-secret",
    )),
    "Changed FawryPay amount must fail",
  );
});
