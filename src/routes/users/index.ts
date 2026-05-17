import Elysia from "elysia";
import { auth } from "@/lib/auth";

import { usersList, usersListSchema } from "./users.list";
import { userDetails, userDetailsSchema } from "./users.details";
import { createUser, createUserSchema } from "./users.create";

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
  .get("/:id", userDetails, userDetailsSchema)
  .post("/", createUser, createUserSchema);
