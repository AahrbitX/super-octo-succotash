import { Elysia } from "elysia";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logging";
import { createOrder, createOrderSchema } from "./payment.create-order";
import { verifyPayment, verifyPaymentSchema } from "./payment.verify";

export const paymentsRouter = new Elysia({ prefix: "/payments" })
  .derive(async ({ request, set }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      logger.warn({ module: "payments", action: "auth", status: 401 }, "Unauthorized access attempt");
      set.status = 401;
      throw new Error("Unauthorized");
    }
    return { user: session.user };
  })
  .post("/create-order", createOrder, createOrderSchema)
  .post("/verify",       verifyPayment, verifyPaymentSchema);
