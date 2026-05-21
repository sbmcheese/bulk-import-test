import { pool, tables, cols, q, notDeleted } from "./db.js";

const retailerTable = `${q(tables.schema)}.${q(tables.retailer)}`;
const storeTable = `${q(tables.schema)}.${q(tables.store)}`;

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function storeKey(retailerId, storeId, storeName) {
  return `${retailerId}|${normalize(storeId)}|${normalize(storeName)}`;
}

async function getRetailersBySubsidiaryId(client, subsidiaryId) {
  const { id, name, subsidiaryId: subsidiaryIdCol } = cols.retailer;
  const result = await client.query(
    `SELECT ${q(id)} AS id, ${q(name)} AS name
     FROM ${retailerTable}
     WHERE ${q(subsidiaryIdCol)} = $1
       AND ${notDeleted()}`,
    [subsidiaryId],
  );

  const byName = new Map();
  for (const row of result.rows) {
    const key = normalize(row.name);
    if (key && !byName.has(key)) {
      byName.set(key, { id: row.id, name: row.name });
    }
  }
  return byName;
}

async function getExistingStoreKeys(client, subsidiaryId) {
  const r = cols.retailer;
  const s = cols.store;
  const result = await client.query(
    `SELECT s.${q(s.retailerId)} AS retailer_id,
            s.${q(s.storeId)} AS store_id,
            s.${q(s.name)} AS store_name
     FROM ${storeTable} s
     INNER JOIN ${retailerTable} r ON s.${q(s.retailerId)} = r.${q(r.id)}
     WHERE r.${q(r.subsidiaryId)} = $1
       AND ${notDeleted("r")}
       AND ${notDeleted("s")}`,
    [subsidiaryId],
  );

  const keys = new Set();
  for (const row of result.rows) {
    keys.add(storeKey(row.retailer_id, row.store_id, row.store_name));
  }
  return keys;
}

async function insertRetailer(client, subsidiaryId, retailerName) {
  const { id, name, subsidiaryId: subsidiaryIdCol } = cols.retailer;
  const result = await client.query(
    `INSERT INTO ${retailerTable} (${q(name)}, ${q(subsidiaryIdCol)})
     VALUES ($1, $2)
     RETURNING ${q(id)} AS id`,
    [retailerName, subsidiaryId],
  );
  return result.rows[0].id;
}

async function insertStore(client, retailerId, storeId, storeName) {
  const { retailerId: retailerIdCol, storeId: storeIdCol, name } = cols.store;
  await client.query(
    `INSERT INTO ${storeTable} (${q(retailerIdCol)}, ${q(storeIdCol)}, ${q(name)})
     VALUES ($1, $2, $3)`,
    [retailerId, storeId, storeName],
  );
}

/**
 * 단일 트랜잭션: 신규 retailer 선등록 → store INSERT
 * EXISTING(중복) 행은 건너뜀
 */
export async function runBulkImport(subsidiaryId, rows) {
  if (!subsidiaryId) {
    throw new Error("subsidiaryId is required");
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("rows array is required");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const retailersByName = await getRetailersBySubsidiaryId(client, subsidiaryId);
    const existingStoreKeys = await getExistingStoreKeys(client, subsidiaryId);
    const pendingRetailerIds = new Map();

    let retailersCreated = 0;
    let storesCreated = 0;
    let skipped = 0;

    for (const row of rows) {
      const storeId = row.storeId ?? "";
      const storeName = row.storeName ?? "";
      const retailerName = row.retailerName ?? "";
      const normRetailer = normalize(retailerName);

      let retailerId = retailersByName.get(normRetailer)?.id;

      if (!retailerId && pendingRetailerIds.has(normRetailer)) {
        retailerId = pendingRetailerIds.get(normRetailer);
      }

      if (!retailerId) {
        retailerId = await insertRetailer(client, subsidiaryId, retailerName);
        pendingRetailerIds.set(normRetailer, retailerId);
        retailersByName.set(normRetailer, { id: retailerId, name: retailerName });
        retailersCreated++;
      }

      const key = storeKey(retailerId, storeId, storeName);
      if (existingStoreKeys.has(key)) {
        skipped++;
        continue;
      }

      await insertStore(client, retailerId, storeId, storeName);
      existingStoreKeys.add(key);
      storesCreated++;
    }

    await client.query("COMMIT");

    return {
      retailersCreated,
      storesCreated,
      skipped,
      imported: storesCreated,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
