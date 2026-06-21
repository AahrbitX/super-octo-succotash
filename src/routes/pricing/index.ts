import Elysia from "elysia";
import { auth } from "@/lib/auth";

import { pricingList, pricingListSchema } from "./pricing.list";
import { pricingUpsert, pricingUpsertSchema } from "./pricing.upsert";

import { requireAdmin } from "@/lib/guards";

export const pricingRouter = new Elysia({ prefix: "/pricing" })
  // Public — anyone can read pricing
  .get("/", pricingList, pricingListSchema)
  // Admin-only — upsert pricing
  .guard({}, (app) =>
    app
      .derive(async ({ request, set }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) {
          set.status = 401;
          throw new Error("Unauthorized");
        }
        return { user: session.user };
      })
      .onBeforeHandle(requireAdmin)
      .post("/", pricingUpsert, pricingUpsertSchema),
  );
