exports.up = async function (knex) {
  await knex.schema.alterTable("crop_case_events", (table) => {
    table.text("video_url").nullable();
  });
  await knex.raw("ALTER TABLE crop_case_events DROP CONSTRAINT crop_case_events_type_ck");
  await knex.raw(`
    ALTER TABLE crop_case_events
    ADD CONSTRAINT crop_case_events_type_ck
    CHECK (event_type IN ('reported', 'action', 'follow_up', 'observation', 'expert_request', 'status_change', 'photo', 'video'))
  `);
};

exports.down = async function (knex) {
  await knex.raw("ALTER TABLE crop_case_events DROP CONSTRAINT crop_case_events_type_ck");
  await knex.raw(`
    ALTER TABLE crop_case_events
    ADD CONSTRAINT crop_case_events_type_ck
    CHECK (event_type IN ('reported', 'action', 'follow_up', 'observation', 'expert_request', 'status_change', 'photo'))
  `);
  await knex.schema.alterTable("crop_case_events", (table) => {
    table.dropColumn("video_url");
  });
};
