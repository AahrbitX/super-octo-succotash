// src/routes/webhooks/index.ts
import Elysia from "elysia";
import { handleRazorpayWebhook } from "./razorpay";

export const webhooksRouter = new Elysia({ prefix: "/webhooks" })
  /**
   * POST /api/webhooks/razorpay
   * Receives Razorpay payment events. Signature verified inside the handler.
   */
  .post("/razorpay", handleRazorpayWebhook);
