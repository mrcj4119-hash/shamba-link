exports.up = async function (knex) {
  await knex.schema.createTable("expert_profiles", (table) => {
    table.uuid("user_id").primary().references("id").inTable("users").onDelete("CASCADE");
    table.text("license_number").notNullable();
    table.text("expertise").notNullable();
    table.text("license_document_url").notNullable();
    table.text("good_conduct_document_url").notNullable();
    table.integer("experience_years").notNullable();
    table.boolean("available").notNullable().defaultTo(false);
    table.integer("service_radius_km").notNullable();
    table.decimal("consultation_rate_kes", 10, 2).notNullable().defaultTo(0);
    table.text("verification_status").notNullable().defaultTo("pending");
    table.uuid("reviewed_by").nullable().references("id").inTable("users").onDelete("SET NULL");
    table.timestamp("reviewed_at", { useTz: true }).nullable();
    table.text("review_note").notNullable().defaultTo("");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.check("experience_years >= 0 AND experience_years <= 80", [], "expert_profiles_experience_ck");
    table.check("service_radius_km > 0 AND service_radius_km <= 1000", [], "expert_profiles_radius_ck");
    table.check("consultation_rate_kes >= 0", [], "expert_profiles_rate_ck");
    table.check("verification_status IN ('pending', 'verified', 'rejected')", [], "expert_profiles_status_ck");
    table.index(["verification_status", "created_at"], "expert_profiles_review_queue_idx");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("expert_profiles");
};
