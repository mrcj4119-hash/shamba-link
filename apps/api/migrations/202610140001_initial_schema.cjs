exports.up = async function (knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  await knex.raw("CREATE TYPE user_role AS ENUM ('farmer', 'agrovet', 'expert')");
  await knex.raw("CREATE TYPE consultation_status AS ENUM ('pending', 'completed', 'cancelled')");
  await knex.raw("CREATE TYPE order_status AS ENUM ('pending', 'processing', 'delivered')");

  await knex.schema.createTable("users", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.text("name").notNullable();
    table.text("email").notNullable().unique("users_email_uq");
    table.text("password_hash").notNullable();
    table.specificType("role", "user_role").notNullable();
    table.text("phone").notNullable();
    table.text("location_region").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["role", "location_region"], "users_role_region_idx");
  });

  await knex.schema.createTable("diagnoses", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("farmer_id").notNullable().references("id").inTable("users").onDelete("RESTRICT");
    table.text("image_url").notNullable();
    table.text("detected_disease").notNullable();
    table.decimal("confidence_score", 5, 4).notNullable();
    table.text("severity_level").notNullable();
    table.text("treatment_recommendations").notNullable();
    table.text("preventive_measures").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.check("confidence_score >= 0 AND confidence_score <= 1", [], "diagnoses_confidence_range_ck");
    table.check("severity_level IN ('low', 'moderate', 'high', 'critical', 'unknown')", [], "diagnoses_severity_ck");
    table.index(["farmer_id", "created_at"], "diagnoses_farmer_created_idx");
  });

  await knex.schema.createTable("products", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("vendor_id").notNullable().references("id").inTable("users").onDelete("RESTRICT");
    table.text("name").notNullable();
    table.text("category").notNullable();
    table.decimal("price", 12, 2).notNullable();
    table.integer("stock_quantity").notNullable();
    table.text("description").notNullable();
    table.text("image_url").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.check("price >= 0", [], "products_price_nonnegative_ck");
    table.check("stock_quantity >= 0", [], "products_stock_nonnegative_ck");
    table.index(["category", "created_at"], "products_category_created_idx");
    table.index(["vendor_id", "created_at"], "products_vendor_created_idx");
  });

  await knex.schema.createTable("consultations", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("farmer_id").notNullable().references("id").inTable("users").onDelete("RESTRICT");
    table.uuid("expert_id").notNullable().references("id").inTable("users").onDelete("RESTRICT");
    table.uuid("diagnosis_id").nullable().references("id").inTable("diagnoses").onDelete("RESTRICT");
    table.specificType("status", "consultation_status").notNullable().defaultTo("pending");
    table.timestamp("scheduled_time", { useTz: true }).notNullable();
    table.text("notes").notNullable().defaultTo("");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(["expert_id", "scheduled_time"], "consultations_expert_time_idx");
    table.index(["farmer_id", "created_at"], "consultations_farmer_created_idx");
  });
  await knex.raw(
    "CREATE UNIQUE INDEX consultations_expert_pending_slot_uq ON consultations (expert_id, scheduled_time) WHERE status = 'pending'",
  );

  await knex.schema.createTable("orders", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("farmer_id").notNullable().references("id").inTable("users").onDelete("RESTRICT");
    table.uuid("vendor_id").notNullable().references("id").inTable("users").onDelete("RESTRICT");
    table.decimal("total_amount", 12, 2).notNullable();
    table.specificType("status", "order_status").notNullable().defaultTo("pending");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.check("total_amount >= 0", [], "orders_total_nonnegative_ck");
    table.index(["farmer_id", "created_at"], "orders_farmer_created_idx");
    table.index(["vendor_id", "status", "created_at"], "orders_vendor_status_created_idx");
  });

  await knex.schema.createTable("order_items", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("order_id").notNullable().references("id").inTable("orders").onDelete("CASCADE");
    table.uuid("product_id").notNullable().references("id").inTable("products").onDelete("RESTRICT");
    table.integer("quantity").notNullable();
    table.decimal("price", 12, 2).notNullable();
    table.check("quantity > 0", [], "order_items_quantity_positive_ck");
    table.check("price >= 0", [], "order_items_price_nonnegative_ck");
    table.unique(["order_id", "product_id"], { indexName: "order_items_order_product_uq" });
    table.index(["product_id"], "order_items_product_idx");
  });
};

exports.down = async function (knex) {
  for (const table of ["order_items", "orders", "consultations", "products", "diagnoses", "users"]) {
    await knex.schema.dropTableIfExists(table);
  }
  await knex.raw("DROP TYPE IF EXISTS order_status");
  await knex.raw("DROP TYPE IF EXISTS consultation_status");
  await knex.raw("DROP TYPE IF EXISTS user_role");
};
