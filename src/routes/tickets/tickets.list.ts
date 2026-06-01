import { desc, eq } from "drizzle-orm";
import { t } from "elysia";
import { db } from "@/db";
import { supportTickets } from "@/db/schema";

export const listTicketsSchema = {
  query: t.Object({
    userId: t.Optional(t.String()), // admin: filter tickets for a specific user
  }),
  detail: {
    tags: ["Tickets"],
    description: "List support tickets — own tickets for users, all (or filtered) for admins",
  },
};

export const listTickets = async ({ user, query }: { user: any; query: { userId?: string } }) => {
  const isAdmin = user.role === "admin";
  const targetUserId = isAdmin && query.userId ? query.userId : user.id;

  const tickets = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, targetUserId))
    .orderBy(desc(supportTickets.createdAt));

  return { success: true, data: tickets };
};
