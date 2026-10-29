exports.up = async function (knex) {
  await knex.schema.alterTable("crop_cases", (table) => {
    table.jsonb("ai_assessment").nullable();
    table.text("ai_assessment_status").notNullable().defaultTo("not_requested");
    table.check(
      "ai_assessment_status IN ('available', 'unavailable', 'not_configured', 'not_requested')",
      [],
      "crop_cases_ai_assessment_status_ck",
    );
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("crop_cases", (table) => {
    table.dropColumn("ai_assessment");
    table.dropColumn("ai_assessment_status");
  });
};
