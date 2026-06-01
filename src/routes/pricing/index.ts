import Elysia from "elysia";
import { auth } from "@/lib/auth";

import { pricingList, pricingListSchema } from "./pricing.list";
import { pricingUpsert, pricingUpsertSchema } from "./pricing.upsert";

export const pricingRouter = new Elysia({ prefix: "/pricing" })
  .derive(async ({ request, set }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      set.status = 401;
      throw new Error("Unauthorized");
    }
    return { user: session.user };
  })
  .get("/", pricingList, pricingListSchema)
  .post("/", pricingUpsert, pricingUpsertSchema);
