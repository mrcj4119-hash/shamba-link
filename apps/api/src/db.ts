import knexFactory from "knex";
import { env } from "./config/env.js";

export const db = knexFactory({
  client: "pg",
  connection: env.DATABASE_URL,
  pool: { min: 0, max: env.NODE_ENV === "production" ? 20 : 10 },
});
