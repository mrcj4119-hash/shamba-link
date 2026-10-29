exports.up = async function (knex) {
  await knex.schema.alterTable("users", (table) => {
    table.boolean("expert_credentials_verified").notNullable().defaultTo(false);
    table.boolean("expert_available").notNullable().defaultTo(false);
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("expert_available");
    table.dropColumn("expert_credentials_verified");
  });
};
