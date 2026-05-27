import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { supportTickets } from "@/db/schema";

export const listTicketsSchema = {
  detail: {
    tags: ["Tickets"],
    description: "List all support tickets for the authenticated user",
  },
};

export const listTickets = async ({ user }: { user: any }) => {
  const tickets = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, user.id))
    .orderBy(desc(supportTickets.createdAt));

  return { success: true, data: tickets };
};
