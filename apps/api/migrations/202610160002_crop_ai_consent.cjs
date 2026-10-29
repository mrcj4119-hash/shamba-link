exports.up = async function (knex) {
  await knex.schema.alterTable("crop_cases", (table) => {
    table.dropChecks("crop_cases_ai_assessment_status_ck");
    table.check(
      "ai_assessment_status IN ('available', 'unavailable', 'not_configured', 'not_requested')",
      [],
      "crop_cases_ai_assessment_status_ck",
    );
  });
  await knex("crop_cases")
    .whereNull("ai_assessment_status")
    .update({ ai_assessment_status: "not_requested" });
  await knex.raw("ALTER TABLE crop_cases ALTER COLUMN ai_assessment_status SET DEFAULT 'not_requested'");
};

exports.down = async function (knex) {
  await knex("crop_cases")
    .where({ ai_assessment_status: "not_requested" })
    .update({ ai_assessment_status: "not_configured" });
  await knex.schema.alterTable("crop_cases", (table) => {
    table.dropChecks("crop_cases_ai_assessment_status_ck");
    table.check(
      "ai_assessment_status IN ('available', 'unavailable', 'not_configured')",
      [],
      "crop_cases_ai_assessment_status_ck",
    );
  });
  await knex.raw("ALTER TABLE crop_cases ALTER COLUMN ai_assessment_status SET DEFAULT 'not_configured'");
};
