import { db } from "@/db";
import { t } from "elysia";

import { eq } from "drizzle-orm";
import { reviews as reviewsTable } from "@/db/schema";

export const readReviewSchema = {
  params: t.Object({ id: t.String() }),
  details: {
    tags: ["Reviews"],
    operationId: "read-review",
    description: "",
  },
};

const readReview = async ({
  user,
  params,
  set,
}: {
  user: any;
  set: any;
  params: (typeof readReviewSchema)["params"]["static"];
}) => {
  if ((user as any).role !== "admin") {
    set.status = 403;
    return { success: false };
  }
  await db
    .update(reviewsTable)
    .set({ unread: false })
    .where(eq(reviewsTable.id, params.id));

  return { success: true };
};

export { readReview };
