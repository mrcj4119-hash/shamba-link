exports.up = async function (knex) {
  await knex.schema.alterTable("diagnoses", (table) => {
    table.text("video_url").nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("diagnoses", (table) => {
    table.dropColumn("video_url");
  });
};
