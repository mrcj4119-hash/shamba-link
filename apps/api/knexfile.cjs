require("dotenv").config({ path: "../../.env" });

module.exports = {
  development: {
    client: "pg",
    connection: process.env.DATABASE_URL,
    migrations: { directory: "./migrations", extension: "cjs" },
    seeds: { directory: "./seeds", extension: "cjs" }
  },
  production: {
    client: "pg",
    connection: process.env.DATABASE_URL,
    migrations: { directory: "./migrations", extension: "cjs" },
    pool: { min: 2, max: 20 }
  }
};
