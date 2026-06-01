import postgres from "postgres";

const DATABASE_URL =
  "postgresql://neondb_owner:npg_6FeyBQACvY5x@ep-wandering-poetry-aoj4298k-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const sql = postgres(DATABASE_URL, { ssl: "require", max: 1 });

async function run() {
  console.log("Adding flagged + unread columns to reviews table…");

  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false`;
  console.log("✓ flagged column added");

  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS unread boolean NOT NULL DEFAULT true`;
  console.log("✓ unread column added");

  console.log("Migration complete.");
  await sql.end();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
