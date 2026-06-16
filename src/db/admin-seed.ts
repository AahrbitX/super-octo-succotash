import { eq } from "drizzle-orm";
import { db } from "../db";
import { auth } from "../lib/auth";
import { user as userTable } from "./auth-schema";

const ADMIN_PHONE = "8056054719";

export async function seedAdmin() {
  console.log("Seeding admin user...");

  const [existing] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.phoneNumber, ADMIN_PHONE))
    .limit(1);

  if (existing) {
    console.log(`  skip  admin (${ADMIN_PHONE} already exists)`);
    return;
  }

  await auth.api.signUpEmail({
    body: {
      email:       `${ADMIN_PHONE}@mohan-cabs.com`,
      password:    "adminpassword",
      name:        "Karthikeyan",
      role:        "admin",
      phoneNumber: ADMIN_PHONE,
      dob:         "10-12-2002",
    },
  });

  console.log(`  added admin (${ADMIN_PHONE})`);
  console.log(`  email: ${ADMIN_PHONE}@mohan-cabs.com`);
}

// Standalone entry point
if (import.meta.main) {
  seedAdmin().then(() => process.exit(0)).catch((err) => {
    console.error("Admin seed failed:", err);
    process.exit(1);
  });
}
