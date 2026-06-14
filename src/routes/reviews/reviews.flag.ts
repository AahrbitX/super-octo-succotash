import { t } from "elysia";
import { db } from "@/db";

import { eq } from "drizzle-orm";
import { reviews as reviewsTable } from "@/db/schema";

export const flagReviewSchema = {
  params: t.Object({ id: t.String() }),
  details: {
    tags: ["Reviews"],
    operationId: "flag-review",
    description: "",
  },
};

const flagReview = async ({
  user,
  params,
  set,
}: {
  user: any;
  set: any;
  params: (typeof flagReviewSchema)["params"]["static"];
}) => {
  const [row] = await db
    .select({ id: reviewsTable.id, flagged: reviewsTable.flagged })
    .from(reviewsTable)
    .where(eq(reviewsTable.id, params.id))
    .limit(1);

  if (!row) {
    set.status = 404;
    return { success: false, message: "Review not found" };
  }

  await db
    .update(reviewsTable)
    .set({ flagged: !row.flagged })
    .where(eq(reviewsTable.id, params.id));

  return {
    success: true,
    message: `Review: ${row.id} is ${row.flagged ? "flagged" : "un flagged"}`,
  };
};

export { flagReview };
