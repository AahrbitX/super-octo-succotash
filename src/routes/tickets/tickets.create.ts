import { t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings as bookingsTable, supportTickets } from "@/db/schema";

export const createTicketSchema = {
  body: t.Object({
    bookingId: t.Optional(t.String()),
    category: t.Union([
      t.Literal("payment"),
      t.Literal("driver_issue"),
      t.Literal("route_issue"),
      t.Literal("other"),
    ]),
    subject: t.String({ minLength: 3, maxLength: 200 }),
    description: t.String({ minLength: 5 }),
  }),
  detail: {
    tags: ["Tickets"],
    description: "Raise a support ticket",
  },
};

export const createTicket = async ({
  user,
  body,
  set,
}: {
  user: any;
  body: { bookingId?: string; category: string; subject: string; description: string };
  set: any;
}) => {
  // If a bookingId is provided, verify the booking belongs to this user
  if (body.bookingId) {
    const [booking] = await db
      .select({ id: bookingsTable.id, userId: bookingsTable.userId })
      .from(bookingsTable)
      .where(eq(bookingsTable.id, body.bookingId))
      .limit(1);

    if (!booking) {
      set.status = 404;
      return { success: false, message: "Booking not found" };
    }

    if (booking.userId !== user.id) {
      set.status = 403;
      return { success: false, message: "Forbidden" };
    }
  }

  const [ticket] = await db
    .insert(supportTickets)
    .values({
      userId:      user.id,
      bookingId:   body.bookingId ?? null,
      category:    body.category as any,
      subject:     body.subject,
      description: body.description,
    })
    .returning();

  set.status = 201;
  return { success: true, data: ticket };
};
