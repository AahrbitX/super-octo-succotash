import { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logging";
import { payments as paymentsTable } from "@/db/schema";

export const adminVerifySchema = {
  params: t.Object({ id: t.String() }),
  body: t.Object({ approved: t.Boolean() }),
  detail: {
    tags: ["Payments"],
    operationId: "adminVerifyPayment",
    description: "Admin approves or disputes a cash payment collection",
  },
};

export const adminVerify = async ({
  user,
  params,
  body,
  set,
}: {
  user: any;
  params: { id: string };
  body: { approved: boolean };
  set: any;
}) => {
  const { id } = params;
  const { approved } = body;

  if (user.role !== "admin") {
    set.status = 403;
    return { success: false, message: "Admin access required" };
  }

  logger.info({ module: "payments", action: "admin-verify", paymentId: id, approved, adminId: user.id }, "Admin verifying payment");

  const [payment] = await db
    .select({ id: paymentsTable.id, status: paymentsTable.status })
    .from(paymentsTable)
    .where(eq(paymentsTable.id, id))
    .limit(1);

  if (!payment) {
    set.status = 404;
    return { success: false, message: "Payment not found" };
  }

  if (approved) {
    await db
      .update(paymentsTable)
      .set({ adminVerifiedBy: user.id, adminVerifiedAt: new Date() })
      .where(eq(paymentsTable.id, id));
  } else {
    // Dispute: reset back to created so user can retry
    await db
      .update(paymentsTable)
      .set({
        status: "created",
        paymentMethod: "online",
        cashVerifiedAt: null,
        adminVerifiedBy: null,
        adminVerifiedAt: null,
      })
      .where(eq(paymentsTable.id, id));
  }

  logger.info({ module: "payments", action: "admin-verify", paymentId: id, approved }, "Admin verification complete");

  set.status = 200;
  return { success: true };
};
