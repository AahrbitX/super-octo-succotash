import postgres from "postgres";

const DATABASE_URL =
  "postgresql://neondb_owner:npg_6FeyBQACvY5x@ep-wandering-poetry-aoj4298k-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const sql = postgres(DATABASE_URL, { ssl: "require", max: 1 });

async function run() {
  console.log("Adding aspect rating columns to reviews table…");

  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS rating_punctuality smallint`;
  console.log("✓ rating_punctuality");

  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS rating_cleanliness smallint`;
  console.log("✓ rating_cleanliness");

  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS rating_behavior smallint`;
  console.log("✓ rating_behavior");

  await sql`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS rating_driving smallint`;
  console.log("✓ rating_driving");

  console.log("Migration complete.");
  await sql.end();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
