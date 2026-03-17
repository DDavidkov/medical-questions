import pg from "pg";
import { config } from "../config/index.js";

const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
});

export async function query<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export default pool;
