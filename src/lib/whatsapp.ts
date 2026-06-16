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
    const parts = [...opts.bodyParams];
    if (opts.buttonParam) parts.push(`[URL] ${opts.buttonParam}`);
    logger.info(
      { template: opts.templateName, to: opts.to, params: parts },
      `[DEV WhatsApp] → ${opts.to} | ${opts.templateName} | params: ${parts.join(" | ")}`
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

