exports.up = async function (knex) {
  await knex.raw("ALTER TYPE user_role ADD VALUE 'admin'");
};

exports.down = async function (knex) {
  const admins = await knex("users").where({ role: "admin" }).count("id as count").first();
  if (Number(admins.count) > 0) {
    throw new Error("Cannot remove the admin role while admin accounts exist.");
  }
  await knex.raw("CREATE TYPE user_role_without_admin AS ENUM ('farmer', 'agrovet', 'expert')");
  await knex.raw("ALTER TABLE users ALTER COLUMN role TYPE user_role_without_admin USING role::text::user_role_without_admin");
  await knex.raw("DROP TYPE user_role");
  await knex.raw("ALTER TYPE user_role_without_admin RENAME TO user_role");
};
