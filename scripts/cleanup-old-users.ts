import { db } from "../src/db";
import { user } from "../src/db/auth-schema";
import { bookings } from "../src/db/schema";
import { like, inArray, and, ne } from "drizzle-orm";

// 1. Find all users from the old flow
const oldUsers = await db
  .select({ id: user.id, email: user.email })
  .from(user)
  .where(and(like(user.email, "%@mohan-cabs.com"), ne(user.role, "admin")));

if (oldUsers.length === 0) {
  console.log("No old users found.");
  process.exit(0);
}

const ids = oldUsers.map((u) => u.id);
console.log(`Found ${oldUsers.length} old user(s) to delete.`);

// 2. Delete their bookings first (no cascade on bookings FK)
const deletedBookings = await db
  .delete(bookings)
  .where(inArray(bookings.bookedByUserId, ids))
  .returning({ id: bookings.id });

console.log(`Deleted ${deletedBookings.length} booking(s).`);

// 3. Now delete the users (sessions/accounts cascade automatically)
const deletedUsers = await db
  .delete(user)
  .where(inArray(user.id, ids))
  .returning({ id: user.id, email: user.email });

console.log(`Deleted ${deletedUsers.length} user(s):`);
deletedUsers.forEach((u) => console.log(` - ${u.email}`));

process.exit(0);
