import Elysia from "elysia";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logging";

import { createTicket, createTicketSchema } from "./tickets.create";
import { listTickets, listTicketsSchema } from "./tickets.list";

export const ticketsRouter = new Elysia({ prefix: "/tickets" })
  .derive(async ({ request, set }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      logger.warn({ module: "tickets", action: "auth", status: 401 }, "Unauthorized");
      set.status = 401;
      throw new Error("Unauthorized");
    }
    return { user: session.user };
  })
  .get("/", listTickets, listTicketsSchema)
  .post("/", createTicket, createTicketSchema);
