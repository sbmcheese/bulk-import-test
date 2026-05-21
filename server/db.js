import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:
    process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

export const tables = {
  schema: "public",
  region: "region",
  subsidiary: "subsidiary",
  retailer: "retailer",
  store: "store",
};

export const cols = {
  region: { id: "id", name: "name" },
  subsidiary: { id: "id", code: "code", regionId: "region_id" },
  retailer: { id: "id", name: "name", subsidiaryId: "subsidiary_id" },
  store: {
    id: "id",
    retailerId: "retailer_id",
    storeId: "store_id",
    name: "name",
  },
  deletedAt: "deleted_at",
};

export function q(ident) {
  return `"${ident}"`;
}

/** 조회: deleted_at IS NULL */
export function notDeleted(tableAlias = "") {
  const prefix = tableAlias ? `${q(tableAlias)}.` : "";
  return `${prefix}${q(cols.deletedAt)} IS NULL`;
}

/** 삭제(soft): deleted_at = NOW() */
export function softDeleteSet(tableAlias = "") {
  const prefix = tableAlias ? `${q(tableAlias)}.` : "";
  return `${prefix}${q(cols.deletedAt)} = NOW()`;
}
