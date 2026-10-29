exports.up = async function (knex) {
  await knex.schema.createTable("photo_feedback_payments", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("farmer_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.uuid("session_id").notNullable();
    table.text("receipt_code").notNullable().unique("photo_feedback_payments_receipt_uq");
    table.integer("amount_kes").notNullable().defaultTo(10);
    table.text("status").notNullable().defaultTo("pending");
    table.uuid("reviewed_by").nullable().references("id").inTable("users").onDelete("SET NULL");
    table.timestamp("reviewed_at", { useTz: true }).nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.check("amount_kes = 10", [], "photo_feedback_payments_amount_ck");
    table.check("status IN ('pending', 'approved', 'rejected')", [], "photo_feedback_payments_status_ck");
    table.unique(["farmer_id", "session_id"], { indexName: "photo_feedback_payments_session_uq" });
    table.index(["status", "created_at"], "photo_feedback_payments_status_created_idx");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("photo_feedback_payments");
};
