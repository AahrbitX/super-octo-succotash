import { Elysia } from "elysia";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logging";
import { createOrder, createOrderSchema } from "./payment.create-order";
import { verifyPayment, verifyPaymentSchema } from "./payment.verify";
import { listTransactions, listTransactionsSchema } from "./payment.list";
import { markCash, markCashSchema } from "./payment.mark-cash";
import { createBalancePayment, createBalancePaymentSchema } from "./payment.create-balance";
import { verifyCode, verifyCodeSchema } from "./payment.verify-code";
import { adminVerify, adminVerifySchema } from "./payment.admin-verify";
import { adminListPayments, adminListPaymentsSchema } from "./payment.admin-list";
import { adminPaymentDetail, adminPaymentDetailSchema } from "./payment.admin-detail";
import { resendCode, resendCodeSchema } from "./payment.resend-code";
import { notifyDriver, notifyDriverSchema } from "./payment.notify-driver";

export const paymentsRouter = new Elysia({ prefix: "/payments" })
  .derive(async ({ request, set }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      logger.warn({ module: "payments", action: "auth", status: 401 }, "Unauthorized access attempt");
      set.status = 401;
      throw new Error("Unauthorized");
    }
    if (session.user.banned) {
      set.status = 403;
      throw new Error("Account suspended");
    }
    return { user: session.user };
  })
  .get("/my-transactions",       listTransactions, listTransactionsSchema)
  .post("/create-order",         createOrder,      createOrderSchema)
  .post("/verify",               verifyPayment,    verifyPaymentSchema)
  .post("/:id/create-balance",   createBalancePayment, createBalancePaymentSchema)
  .post("/:id/notify-driver",    notifyDriver,     notifyDriverSchema)
  .post("/:id/mark-cash",        markCash,         markCashSchema)
  .post("/:id/verify-code",      verifyCode,       verifyCodeSchema)
  .post("/:id/resend-code",      resendCode,       resendCodeSchema)
  .patch("/:id/admin-verify",    adminVerify,      adminVerifySchema)
  .get("/admin",                 adminListPayments,     adminListPaymentsSchema)
  .get("/admin/:id",             adminPaymentDetail,    adminPaymentDetailSchema);
