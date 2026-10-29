const path = require("node:path");
const bcrypt = require("bcryptjs");
const knexFactory = require("knex");

require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

async function main() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const missing = [
    !name && "ADMIN_NAME",
    !email && "ADMIN_EMAIL",
    !password && "ADMIN_PASSWORD",
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`Set ${missing.join(", ")} in the project .env before running this command.`);
  }
  if (name.length < 2 || name.length > 100) {
    throw new Error("ADMIN_NAME must be between 2 and 100 characters.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("ADMIN_EMAIL must be a valid email address.");
  }
  if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters and no more than 72 UTF-8 bytes.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set in the project .env.");
  }

  const db = knexFactory({
    client: "pg",
    connection: process.env.DATABASE_URL,
  });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const inserted = await db("users").insert({
      name,
      email,
      password_hash: passwordHash,
      role: "admin",
      phone: "not-provided",
      location_region: "Platform",
    }).onConflict("email").ignore().returning("id");
    if (!inserted.length) {
      throw new Error("An account already uses ADMIN_EMAIL. This command never modifies existing accounts.");
    }
    console.log(`Created administrator account for ${email}.`);
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Admin account creation failed.");
  process.exitCode = 1;
});
