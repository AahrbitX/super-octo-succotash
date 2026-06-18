import { logger } from "./logging";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SendTemplateOptions {
  to: string;
  templateName: string;
  bodyParams: string[];
  headerParams?: string[]; // text variables in the header component
  buttonParam?: string;    // dynamic URL button variable (index 0)
  languageCode?: string;
}

export interface CashCodePayload {
  to: string;   // customer phone
  code: string;
}



export interface BookingConfirmationPayload {
  customerPhone: string;
  customerName: string;
  bookingRef: string;
  pickupName: string;
  dropName: string;
  journeyDate: string;
  journeyTime: string;
  totalFare: string;
}

export interface BookingAssignedPayload {
  driverPhone: string;
  driverName: string;
  bookingRef: string;
  journeyDateTime: string;  // e.g. "2024-12-01 10:00 AM"
  pickupName: string;
  dropName: string;
  totalFare: string;
  qrToken: string;   // just the UUID token, not the full URL
}

export interface BookingCancelledDriverPayload {
  driverPhone: string;
  driverName: string;
  bookingRef: string;
  customerName: string;
  journeyDate: string;
  journeyTime: string;
}

export interface AdminAlertPayload {
  eventType: string;
  bookingRef: string;
  details: string;
}

export interface LoginOtpPayload {
  phone: string;
  code: string;
}

export interface RideStartOtpPayload {
  phone: string;         // customer phone
  customerName: string;
  bookingRef: string;
  otp: string;
}

export interface ReviewRequestPayload {
  phone: string;         // customer phone
  customerName: string;
  bookingRef: string;
  qrToken: string;       // booking qrToken — used to build the review URL
}

export interface PaymentLinkPayload {
  phone: string;         // customer phone
  customerName: string;
  bookingRef: string;
  amount: string;        // formatted amount e.g. "1500.00"
  qrToken: string;       // booking qrToken — used to build the pay URL
}


// ─── Phone normalizer ─────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  return raw.replace(/^\+/, "").replace(/\s/g, "");
}

// ─── Core send helper ─────────────────────────────────────────────────────────

async function sendTemplate(opts: SendTemplateOptions): Promise<void> {
  const TOKEN    = process.env.WHATSAPP_TOKEN;
  const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const ENABLED  = process.env.WHATSAPP_ENABLED === "true";

  // Console fallback — when not explicitly enabled or credentials missing
  if (!TOKEN || !PHONE_ID || !ENABLED) {
    logger.info(
      {
        whatsapp: true,
        template: opts.templateName,
        to: opts.to,
        params: opts.bodyParams,
        ...(opts.buttonParam ? { url: opts.buttonParam } : {}),
      },
      [
        ``,
        `  ┌─ [DEV WhatsApp] ${"─".repeat(44)}`,
        `  │  Template : ${opts.templateName}`,
        `  │  To       : +${opts.to}`,
        ...opts.bodyParams.map((p, i) => `  │  Param ${i + 1}  : ${p}`),
        ...(opts.buttonParam ? [`  │  URL      : ${opts.buttonParam}`] : []),
        `  └${"─".repeat(58)}`,
        ``,
      ].join("\n")
    );
    return;
  }

  // In dev/test mode, override template with hello_world (test accounts only support this)
  const testTemplate = process.env.WHATSAPP_TEST_TEMPLATE;
  const templateName = testTemplate ?? opts.templateName;
  const bodyParams   = testTemplate ? [] : opts.bodyParams;

  const components: object[] = [];

  const headerParams = testTemplate ? [] : (opts.headerParams ?? []);
  if (headerParams.length > 0) {
    components.push({
      type: "header",
      parameters: headerParams.map((text) => ({ type: "text", text })),
    });
  }

  if (bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParams.map((text) => ({ type: "text", text })),
    });
  }

  if (opts.buttonParam) {
    components.push({
      type:      "button",
      sub_type:  "url",
      index:     "0",
      parameters: [{ type: "text", text: opts.buttonParam }],
    });
  }

  const res = await fetch(
    `https://graph.facebook.com/v20.0/${PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to:   opts.to,
        type: "template",
        template: {
          name:       templateName,
          language:   { code: opts.languageCode ?? "en" },
          components,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`WhatsApp API ${res.status}: ${JSON.stringify(err)}`);
  }

  logger.info(
    { template: templateName, to: opts.to },
    `[WhatsApp] Message sent → ${opts.to} | ${templateName}`
  );
}

// ─── Exported typed functions ─────────────────────────────────────────────────

/**
 * Notify a driver of a cash booking and send their confirmation code.
 * Sends two messages:
 *  1. driver_booking_details (Utility)   — bookingRef, amount
 *  2. driver_cash_code       (Authentication) — code only
 *
 * Template bodies:
 *  driver_booking_details: "Booking {{1}} - You have a cash ride worth ₹{{2}}. A separate confirmation phrase will follow."
 *  driver_cash_code: fixed by Meta — "Your Mohan Cabs code is {{1}}"
 */
export async function sendCashCode(payload: CashCodePayload): Promise<void> {
  await sendTemplate({
    to:           normalizePhone(payload.to),
    templateName: "payment_otp",
    bodyParams:   [payload.code],
    buttonParam:  payload.code,
  });
}

/**
 * Send booking confirmation to the customer after a booking is created.
 * Template: booking_confirmation_customer
 * Body params: customerName, bookingRef, pickupName, dropName, journeyDate, journeyTime, totalFare
 */
export async function sendBookingConfirmation(
  payload: BookingConfirmationPayload
): Promise<void> {
  await sendTemplate({
    to:           normalizePhone(payload.customerPhone),
    templateName: "booking_confirmation_customer",
    bodyParams:   [
      payload.customerName,
      payload.bookingRef,
      payload.pickupName,
      payload.dropName,
      payload.journeyDate,
      payload.journeyTime,
      payload.totalFare,
    ],
  });
}

/**
 * Notify a driver when they are assigned to a booking.
 * Template: booking_assigned_driver
 * Body params: driverName, bookingRef, pickupName, dropName, journeyDateTime, totalFare
 * Button: rideUrl (dynamic URL)
 */
export async function sendBookingAssigned(
  payload: BookingAssignedPayload
): Promise<void> {
  await sendTemplate({
    to:           normalizePhone(payload.driverPhone),
    templateName: "booking_assigned_driver",
    bodyParams:   [
      payload.driverName,
      payload.bookingRef,
      payload.pickupName,
      payload.dropName,
      payload.journeyDateTime,
      payload.totalFare,
    ],
    buttonParam: payload.qrToken,
  });
}

/**
 * Notify a driver that their assigned booking has been cancelled.
 * Template: booking_cancelled_driver
 * Body params: driverName, bookingRef, customerName, journeyDate, journeyTime
 */
export async function sendBookingCancelledToDriver(
  payload: BookingCancelledDriverPayload
): Promise<void> {
  await sendTemplate({
    to:           normalizePhone(payload.driverPhone),
    templateName: "booking_cancelled_driver",
    bodyParams:   [
      payload.driverName,
      payload.bookingRef,
      payload.customerName,
      payload.journeyDate,
      payload.journeyTime,
    ],
  });
}

/**
 * Send an admin alert to a single admin phone number.
 * Template: admin_alert
 * Body params: eventType, bookingRef, details
 */
export async function sendAdminAlert(
  adminPhone: string,
  payload: AdminAlertPayload
): Promise<void> {
  await sendTemplate({
    to:           normalizePhone(adminPhone),
    templateName: "admin_alert",
    headerParams: [payload.eventType],
    bodyParams:   [payload.bookingRef, payload.details],
  });
}

/**
 * Send an admin alert to all admin phone numbers (fires in parallel).
 */
export function getAdminPhones(): string[] {
  const raw = process.env.WHATSAPP_ADMIN_PHONE ?? "";
  return raw.split(",").map((p) => p.trim()).filter(Boolean);
}

export async function sendAdminAlertToAll(
  adminPhones: string[],
  payload: AdminAlertPayload
): Promise<void> {
  await Promise.allSettled(
    adminPhones.map((phone) => sendAdminAlert(phone, payload))
  );
}

/**
 * Send a login / verification OTP to a user via WhatsApp.
 * Template: login_otp  (Authentication category)
 * Body param: {{1}} = OTP code
 */
export async function sendLoginOtp(payload: LoginOtpPayload): Promise<void> {
  await sendTemplate({
    to:           normalizePhone(payload.phone),
    templateName: "login_otp",
    bodyParams:   [payload.code],
    buttonParam:  payload.code,
    languageCode: "en",
  });
}

/**
 * Send a ride-start OTP to the customer after driver assignment.
 * Template: ride_start_otp
 * Body params: customerName, bookingRef, otp
 * "Hi {{1}}, your ride start OTP for booking {{2}} is *{{3}}*. Share this with your driver when they arrive."
 */
export async function sendRideStartOtp(payload: RideStartOtpPayload): Promise<void> {
  await sendTemplate({
    to:           normalizePhone(payload.phone),
    templateName: "ride_start_otp",
    bodyParams:   [payload.customerName, payload.bookingRef, payload.otp],
  });
}

/**
 * Send a review request to the customer after ride completion.
 * Template: review_request
 * Body params: customerName, bookingRef
 * Button URL: qrToken (appended to base review URL)
 * "Hi {{1}}, how was your ride {{2}}? Please tap below to rate your experience."
 */
export async function sendReviewRequest(payload: ReviewRequestPayload): Promise<void> {
  const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
  await sendTemplate({
    to:           normalizePhone(payload.phone),
    templateName: "review_request",
    bodyParams:   [payload.customerName, payload.bookingRef],
    buttonParam:  `${FRONTEND_URL}/review/${payload.qrToken}`,
  });
}

/**
 * Send a pending payment link to the customer.
 * Template: payment_reminder
 * Body params: customerName, amount, bookingRef
 * Button URL: qrToken (appended to base pay URL)
 * "Hi {{1}}, your payment of ₹{{2}} for booking {{3}} is pending. Tap below to pay now."
 */
export async function sendPaymentLink(payload: PaymentLinkPayload): Promise<void> {
  const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
  await sendTemplate({
    to:           normalizePhone(payload.phone),
    templateName: "payment_reminder",
    bodyParams:   [payload.customerName, payload.amount, payload.bookingRef],
    buttonParam:  `${FRONTEND_URL}/pay/${payload.qrToken}`,
  });
}

