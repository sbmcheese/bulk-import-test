import { pool, tables, cols, q, notDeleted } from "./db.js";

const regionTable = `${q(tables.schema)}.${q(tables.region)}`;
const subsidiaryTable = `${q(tables.schema)}.${q(tables.subsidiary)}`;

export async function getRegions() {
  const { id, name } = cols.region;
  const result = await pool.query(
    `SELECT ${q(id)} AS id, ${q(name)} AS name
     FROM ${regionTable}
     WHERE ${notDeleted()}
     ORDER BY ${q(name)} ASC`,
  );
  return result.rows;
}

export async function getSubsidiaries(regionId) {
  if (!regionId) {
    throw new Error("regionId is required");
  }

  const { id, code, regionId: regionIdCol } = cols.subsidiary;
  const result = await pool.query(
    `SELECT ${q(id)} AS id, ${q(code)} AS code
     FROM ${subsidiaryTable}
     WHERE ${q(regionIdCol)} = $1
       AND ${notDeleted()}
     ORDER BY ${q(code)} ASC`,
    [regionId],
  );
  return result.rows;
}

export { runImportDryRun, IMPORT_STATUS, IMPORT_STATUS_LABEL } from "./dryRun.js";
export { runBulkImport } from "./import.js";
export {
  getRetailersWithStoreCount,
  getDeletePreview,
  runBulkDelete,
} from "./delete.js";

export async function pingDb() {
  await pool.query("SELECT 1");
  return { ok: true };
}
