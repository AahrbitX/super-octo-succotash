import { db } from "../src/db";
import { user } from "../src/db/auth-schema";

const users = await db
  .select({ id: user.id, name: user.name, email: user.email, phone: user.phoneNumber, role: user.role, createdAt: user.createdAt })
  .from(user);

console.log(`Total users: ${users.length}\n`);
users.forEach((u) => {
  console.log(`Name:    ${u.name}`);
  console.log(`Email:   ${u.email}`);
  console.log(`Phone:   ${u.phone ?? "—"}`);
  console.log(`Role:    ${u.role}`);
  console.log(`Joined:  ${u.createdAt.toLocaleDateString()}`);
  console.log("─".repeat(40));
});

process.exit(0);
