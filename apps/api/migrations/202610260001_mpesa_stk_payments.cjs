exports.up = async function (knex) {
  await knex.schema.alterTable("photo_feedback_payments", (table) => {
    table.text("receipt_code").nullable().alter();
    table.text("merchant_request_id").nullable();
    table.text("checkout_request_id").nullable().unique("photo_feedback_payments_checkout_uq");
    table.text("phone_number").nullable();
    table.integer("result_code").nullable();
    table.text("result_description").nullable();
  });
  await knex.raw(
    "ALTER TABLE photo_feedback_payments DROP CONSTRAINT photo_feedback_payments_status_ck",
  );
  await knex.raw(
    "ALTER TABLE photo_feedback_payments ADD CONSTRAINT photo_feedback_payments_status_ck CHECK (status IN ('initiating', 'pending', 'approved', 'rejected'))",
  );
};

exports.down = async function (knex) {
  const [nullableReceipts] = await knex("photo_feedback_payments")
    .whereNull("receipt_code")
    .count({ count: "*" });
  if (Number(nullableReceipts.count) > 0) {
    throw new Error("Cannot revert M-Pesa payments while STK payment rows have no receipt code.");
  }
  await knex.raw(
    "ALTER TABLE photo_feedback_payments DROP CONSTRAINT photo_feedback_payments_status_ck",
  );
  await knex.raw(
    "ALTER TABLE photo_feedback_payments ADD CONSTRAINT photo_feedback_payments_status_ck CHECK (status IN ('pending', 'approved', 'rejected'))",
  );
  await knex.raw(
    "ALTER TABLE photo_feedback_payments DROP CONSTRAINT photo_feedback_payments_checkout_uq",
  );
  await knex.schema.alterTable("photo_feedback_payments", (table) => {
    table.dropColumn("merchant_request_id");
    table.dropColumn("checkout_request_id");
    table.dropColumn("phone_number");
    table.dropColumn("result_code");
    table.dropColumn("result_description");
    table.text("receipt_code").notNullable().alter();
  });
};
