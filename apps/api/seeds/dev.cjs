const bcrypt = require("bcryptjs");

exports.seed = async function (knex) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development fixtures cannot be seeded in production");
  }
  const password = await bcrypt.hash("ShambaDemo2026!", 12);
  const users = [
    ["demo.farmer@shambalink.test", "Amina Njeri", "farmer", "+254700000001", "Kiambu"],
    ["demo.agrovet@shambalink.test", "Green Harvest Agrovet", "agrovet", "+254700000002", "Kiambu"],
    ["demo.expert@shambalink.test", "Dr. Peter Mwangi", "expert", "+254700000003", "Kiambu"]
  ];
  for (const [email, name, role, phone, location_region] of users) {
    await knex("users").insert({ email, name, role, phone, location_region, password_hash: password })
      .onConflict("email").merge({ name, role, phone, location_region, password_hash: password });
  }
  const vendor = await knex("users").where({ email: users[1][0] }).first("id");
  const products = [
    ["Organic NPK fertilizer", "Fertilizer", "KES 2,400", 34, "Balanced nutrition for stronger, healthier crops.", "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=80"],
    ["Drought-tolerant maize seed", "Seeds", "KES 850", 120, "Quality-assured seed selected for reliable local harvests.", "https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=900&q=80"],
    ["Neem-based crop protectant", "Crop care", "KES 1,100", 22, "A plant-based crop care option. Follow the product label.", "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80"],
    ["Drip irrigation starter kit", "Equipment", "KES 3,800", 12, "Water-saving starter kit for kitchen gardens and small plots.", "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&w=900&q=80"]
  ];
  for (const [name, category, price, stock_quantity, description, image_url] of products) {
    const existing = await knex("products").where({ vendor_id: vendor.id, name }).first("id");
    const values = { category, price: price.replace(/[^\d.]/g, ""), stock_quantity, description, image_url };
    if (existing) await knex("products").where({ id: existing.id }).update(values);
    else await knex("products").insert({ vendor_id: vendor.id, name, ...values });
  }
};
