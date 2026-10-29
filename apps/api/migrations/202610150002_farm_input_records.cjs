exports.up = async function (knex) {
  await knex.schema.createTable("farm_input_records", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("farmer_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.uuid("farm_id").nullable().references("id").inTable("farms").onDelete("SET NULL");
    table.text("product_name").notNullable();
    table.text("intended_use").notNullable();
    table.date("purchase_date").nullable();
    table.text("seller").notNullable().defaultTo("");
    table.text("batch_number").notNullable().defaultTo("");
    table.date("application_date").nullable();
    table.text("instructions_followed").notNullable().defaultTo("");
    table.text("observed_results").notNullable().defaultTo("");
    table.text("complaint_details").notNullable().defaultTo("");
    table.text("complaint_status").notNullable().defaultTo("none");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.check("complaint_status IN ('none', 'submitted_pending_review')", [], "farm_input_complaint_status_ck");
    table.index(["farmer_id", "created_at"], "farm_input_farmer_created_idx");
    table.index(["farmer_id", "complaint_status"], "farm_input_farmer_complaint_idx");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("farm_input_records");
};
