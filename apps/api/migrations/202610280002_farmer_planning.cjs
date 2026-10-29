exports.up = async function (knex) {
  await knex.schema.createTable("soil_assessments", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("farmer_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.uuid("farm_id").nullable().references("id").inTable("farms").onDelete("SET NULL");
    table.uuid("field_id").nullable().references("id").inTable("crop_fields").onDelete("SET NULL");
    table.text("crop_type").notNullable();
    table.decimal("plot_size_acres", 10, 2).nullable();
    table.date("tested_on").nullable();
    table.decimal("ph", 4, 2).nullable();
    table.text("nitrogen_result").notNullable().defaultTo("");
    table.text("phosphorus_result").notNullable().defaultTo("");
    table.text("potassium_result").notNullable().defaultTo("");
    table.text("result_units").notNullable().defaultTo("");
    table.text("lab_name").notNullable().defaultTo("");
    table.text("notes").notNullable().defaultTo("");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.check("plot_size_acres IS NULL OR plot_size_acres > 0", [], "soil_assessments_plot_size_ck");
    table.check("ph IS NULL OR ph >= 0 AND ph <= 14", [], "soil_assessments_ph_ck");
    table.index(["farmer_id", "created_at"], "soil_assessments_farmer_created_idx");
  });

  await knex.schema.createTable("farm_calendar_tasks", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("farmer_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.uuid("farm_id").nullable().references("id").inTable("farms").onDelete("SET NULL");
    table.uuid("field_id").nullable().references("id").inTable("crop_fields").onDelete("SET NULL");
    table.text("crop_type").notNullable().defaultTo("");
    table.text("task_type").notNullable();
    table.text("title").notNullable();
    table.date("due_on").notNullable();
    table.text("notes").notNullable().defaultTo("");
    table.timestamp("completed_at", { useTz: true }).nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.check("task_type IN ('weeding', 'top_dressing', 'scouting', 'irrigation', 'planting', 'harvest', 'other')", [], "farm_calendar_tasks_type_ck");
    table.index(["farmer_id", "due_on", "completed_at"], "farm_calendar_tasks_farmer_due_idx");
  });

  await knex.schema.createTable("harvest_records", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("farmer_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.uuid("farm_id").nullable().references("id").inTable("farms").onDelete("SET NULL");
    table.uuid("field_id").nullable().references("id").inTable("crop_fields").onDelete("SET NULL");
    table.text("crop_type").notNullable();
    table.date("harvested_on").notNullable();
    table.decimal("quantity", 12, 2).notNullable();
    table.text("unit").notNullable();
    table.decimal("plot_size_acres", 10, 2).nullable();
    table.text("season").notNullable().defaultTo("");
    table.text("notes").notNullable().defaultTo("");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.check("quantity > 0", [], "harvest_records_quantity_ck");
    table.check("plot_size_acres IS NULL OR plot_size_acres > 0", [], "harvest_records_plot_size_ck");
    table.index(["farmer_id", "harvested_on"], "harvest_records_farmer_date_idx");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("harvest_records");
  await knex.schema.dropTableIfExists("farm_calendar_tasks");
  await knex.schema.dropTableIfExists("soil_assessments");
};
