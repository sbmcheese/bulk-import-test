import { pool, tables, cols, q, notDeleted, softDeleteSet } from "./db.js";

const retailerTable = `${q(tables.schema)}.${q(tables.retailer)}`;
const storeTable = `${q(tables.schema)}.${q(tables.store)}`;

/** subsidiary 하위 retailer 목록 + 활성 store 개수 */
export async function getRetailersWithStoreCount(subsidiaryId) {
  if (!subsidiaryId) {
    throw new Error("subsidiaryId is required");
  }

  const r = cols.retailer;
  const s = cols.store;
  const result = await pool.query(
    `SELECT r.${q(r.id)} AS id,
            r.${q(r.name)} AS name,
            COUNT(s.${q(s.id)})::int AS store_count
     FROM ${retailerTable} r
     LEFT JOIN ${storeTable} s
       ON s.${q(s.retailerId)} = r.${q(r.id)}
      AND ${notDeleted("s")}
     WHERE r.${q(r.subsidiaryId)} = $1
       AND ${notDeleted("r")}
     GROUP BY r.${q(r.id)}, r.${q(r.name)}
     ORDER BY r.${q(r.name)} ASC`,
    [subsidiaryId],
  );
  return result.rows;
}

export async function getDeletePreview(retailerIds) {
  if (!Array.isArray(retailerIds) || retailerIds.length === 0) {
    throw new Error("retailerIds array is required");
  }

  const r = cols.retailer;
  const s = cols.store;
  const result = await pool.query(
    `SELECT r.${q(r.id)} AS id,
            r.${q(r.name)} AS name,
            COUNT(s.${q(s.id)})::int AS store_count
     FROM ${retailerTable} r
     LEFT JOIN ${storeTable} s
       ON s.${q(s.retailerId)} = r.${q(r.id)}
      AND ${notDeleted("s")}
     WHERE r.${q(r.id)} = ANY($1)
       AND ${notDeleted("r")}
     GROUP BY r.${q(r.id)}, r.${q(r.name)}
     ORDER BY r.${q(r.name)} ASC`,
    [retailerIds],
  );

  const retailers = result.rows;
  const totalStores = retailers.reduce((sum, row) => sum + row.store_count, 0);

  return { retailers, totalStores };
}

/**
 * 선택 retailer 처리 (단일 트랜잭션, soft delete)
 * - 항상 하위 store 먼저 deleted_at 설정
 * - deleteRetailers true 시 retailer도 soft delete
 */
export async function runBulkDelete(retailerIds, { deleteRetailers = false } = {}) {
  if (!Array.isArray(retailerIds) || retailerIds.length === 0) {
    throw new Error("retailerIds array is required");
  }

  const client = await pool.connect();
  const s = cols.store;
  const r = cols.retailer;

  try {
    await client.query("BEGIN");

    const storeResult = await client.query(
      `UPDATE ${storeTable}
       SET ${softDeleteSet()}
       WHERE ${q(s.retailerId)} = ANY($1)
         AND ${notDeleted()}`,
      [retailerIds],
    );

    let retailersDeleted = 0;
    if (deleteRetailers) {
      const retailerResult = await client.query(
        `UPDATE ${retailerTable}
         SET ${softDeleteSet()}
         WHERE ${q(r.id)} = ANY($1)
           AND ${notDeleted()}`,
        [retailerIds],
      );
      retailersDeleted = retailerResult.rowCount;
    }

    await client.query("COMMIT");

    return {
      storesDeleted: storeResult.rowCount,
      retailersDeleted,
      deleteRetailers,
      retailersAffected: retailerIds.length,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
