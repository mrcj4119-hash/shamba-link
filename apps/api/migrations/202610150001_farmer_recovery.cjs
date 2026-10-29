exports.up = async function (knex) {
  await knex.schema.alterTable("users", (table) => {
    table.text("preferred_language").notNullable().defaultTo("en");
  });
  await knex.schema.createTable("farms", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("farmer_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.text("name").notNullable();
    table.text("county").notNullable();
    table.text("location_description").notNullable().defaultTo("");
    table.decimal("size_acres", 10, 2).nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.check("size_acres IS NULL OR size_acres > 0", [], "farms_size_positive_ck");
    table.index(["farmer_id", "created_at"], "farms_farmer_created_idx");
  });
  await knex.schema.createTable("crop_fields", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("farm_id").notNullable().references("id").inTable("farms").onDelete("CASCADE");
    table.uuid("farmer_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.text("name").notNullable();
    table.text("crop_type").notNullable();
    table.date("planting_date").nullable();
    table.text("soil_type").notNullable().defaultTo("");
    table.text("irrigation_method").notNullable().defaultTo("");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["farmer_id", "farm_id"], "crop_fields_farmer_farm_idx");
  });
  await knex.schema.createTable("crop_cases", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.text("reference").notNullable().unique("crop_cases_reference_uq");
    table.uuid("farmer_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.uuid("farm_id").nullable().references("id").inTable("farms").onDelete("SET NULL");
    table.uuid("field_id").nullable().references("id").inTable("crop_fields").onDelete("SET NULL");
    table.text("crop_type").notNullable();
    table.text("symptoms").notNullable();
    table.date("started_on").nullable();
    table.text("spread_rate").notNullable().defaultTo("unknown");
    table.text("affected_portion").notNullable().defaultTo("");
    table.text("context_notes").notNullable().defaultTo("");
    table.text("status").notNullable().defaultTo("reported");
    table.date("follow_up_on").nullable();
    table.text("latest_outcome").nullable();
    table.text("guidance").notNullable().defaultTo("Photo-only diagnosis is not enabled. Record what you observe and request assessment from a qualified agricultural professional before taking high-risk action.");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.check("spread_rate IN ('slow', 'steady', 'rapid', 'unknown')", [], "crop_cases_spread_ck");
    table.check("status IN ('reported', 'under_review', 'action_required', 'follow_up_due', 'improving', 'referred_to_expert', 'closed')", [], "crop_cases_status_ck");
    table.check("latest_outcome IS NULL OR latest_outcome IN ('improved', 'unchanged', 'worsened')", [], "crop_cases_outcome_ck");
    table.index(["farmer_id", "status", "updated_at"], "crop_cases_farmer_status_idx");
    table.index(["farmer_id", "follow_up_on"], "crop_cases_farmer_followup_idx");
  });
  await knex.schema.createTable("crop_case_events", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("case_id").notNullable().references("id").inTable("crop_cases").onDelete("CASCADE");
    table.uuid("farmer_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.text("event_type").notNullable();
    table.text("notes").notNullable().defaultTo("");
    table.text("outcome").nullable();
    table.text("image_url").nullable();
    table.date("follow_up_on").nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.check("event_type IN ('reported', 'action', 'follow_up', 'observation', 'expert_request', 'status_change', 'photo')", [], "crop_case_events_type_ck");
    table.check("outcome IS NULL OR outcome IN ('improved', 'unchanged', 'worsened')", [], "crop_case_events_outcome_ck");
    table.index(["case_id", "created_at"], "crop_case_events_timeline_idx");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("crop_case_events");
  await knex.schema.dropTableIfExists("crop_cases");
  await knex.schema.dropTableIfExists("crop_fields");
  await knex.schema.dropTableIfExists("farms");
  await knex.schema.alterTable("users", (table) => table.dropColumn("preferred_language"));
};
