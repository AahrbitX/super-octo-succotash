import Elysia from "elysia";
import { auth } from "@/lib/auth";

import { usersList, usersListSchema } from "./users.list";
import { userDetails, userDetailsSchema } from "./users.details";
import { createUser, createUserSchema } from "./users.create";
import { userStats, userStatsSchema } from "./users.stats";
import { usersHasPassword, usersHasPasswordSchema } from "./users.has-password";
import { usersSetPassword, usersSetPasswordSchema } from "./users.set-password";

export const usersRouter = new Elysia({ prefix: "/users" })
  .derive(async ({ request, set }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      set.status = 401;
      throw new Error("Unauthorized");
    }
    return { user: session.user };
  })
  .get("/", usersList, usersListSchema)
  .get("/stats", userStats, userStatsSchema)
  .get("/me/has-password", usersHasPassword, usersHasPasswordSchema)
  .post("/me/password", usersSetPassword, usersSetPasswordSchema)
  .get("/:id", userDetails, userDetailsSchema)
  .post("/", createUser, createUserSchema);
