exports.up = async function (knex) {
  await knex.schema.alterTable("crop_cases", (table) => {
    table.text("case_type").notNullable().defaultTo("crop");
    table.text("subject_name").notNullable().defaultTo("");
  });
  await knex.raw("UPDATE crop_cases SET subject_name = crop_type WHERE subject_name = ''");
  await knex.raw(`
    ALTER TABLE crop_cases
    ADD CONSTRAINT crop_cases_type_ck
    CHECK (case_type IN ('crop', 'livestock'))
  `);
};

exports.down = async function (knex) {
  await knex.raw("ALTER TABLE crop_cases DROP CONSTRAINT crop_cases_type_ck");
  await knex.schema.alterTable("crop_cases", (table) => {
    table.dropColumn("subject_name");
    table.dropColumn("case_type");
  });
};
