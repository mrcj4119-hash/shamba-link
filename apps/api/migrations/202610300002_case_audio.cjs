exports.up = async function (knex) {
  await knex.schema.alterTable("crop_case_events", (table) => {
    table.text("audio_url").nullable();
  });
  await knex.raw("ALTER TABLE crop_case_events DROP CONSTRAINT crop_case_events_type_ck");
  await knex.raw(`
    ALTER TABLE crop_case_events
    ADD CONSTRAINT crop_case_events_type_ck
    CHECK (event_type IN ('reported', 'action', 'follow_up', 'observation', 'expert_request', 'status_change', 'photo', 'video', 'audio'))
  `);
};

exports.down = async function (knex) {
  await knex.raw("ALTER TABLE crop_case_events DROP CONSTRAINT crop_case_events_type_ck");
  await knex.raw(`
    UPDATE crop_case_events
    SET event_type = 'reported',
        notes = notes || ' (voice attachment removed during migration rollback)'
    WHERE event_type = 'audio'
  `);
  await knex.raw(`
    ALTER TABLE crop_case_events
    ADD CONSTRAINT crop_case_events_type_ck
    CHECK (event_type IN ('reported', 'action', 'follow_up', 'observation', 'expert_request', 'status_change', 'photo', 'video'))
  `);
  await knex.schema.alterTable("crop_case_events", (table) => {
    table.dropColumn("audio_url");
  });
};
