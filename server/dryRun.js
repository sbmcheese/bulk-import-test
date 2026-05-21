import { pool, tables, cols, q, notDeleted } from "./db.js";

const retailerTable = `${q(tables.schema)}.${q(tables.retailer)}`;
const storeTable = `${q(tables.schema)}.${q(tables.store)}`;

export const IMPORT_STATUS = {
  NEW_RETAILER_AND_STORE: "NEW_RETAILER_AND_STORE",
  NEW_STORE: "NEW_STORE",
  EXISTING: "EXISTING",
};

export const IMPORT_STATUS_LABEL = {
  [IMPORT_STATUS.NEW_RETAILER_AND_STORE]: "Retailer/Store 추가",
  [IMPORT_STATUS.NEW_STORE]: "Store 추가",
  [IMPORT_STATUS.EXISTING]: "중복",
};

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function storeKey(retailerId, storeId, storeName) {
  return `${retailerId}|${normalize(storeId)}|${normalize(storeName)}`;
}

async function getRetailersBySubsidiaryId(subsidiaryId) {
  const { id, name, subsidiaryId: subsidiaryIdCol } = cols.retailer;
  const result = await pool.query(
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

async function getExistingStoreKeys(subsidiaryId) {
  const r = cols.retailer;
  const s = cols.store;
  const result = await pool.query(
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

export async function runImportDryRun(subsidiaryId, rows) {
  if (!subsidiaryId) {
    throw new Error("subsidiaryId is required");
  }

  const retailersByName = await getRetailersBySubsidiaryId(subsidiaryId);
  const existingStoreKeys = await getExistingStoreKeys(subsidiaryId);

  const newRetailerNames = new Set();
  let newRetailerAndStore = 0;
  let newStoreOnly = 0;
  let existingStore = 0;

  const previewRows = rows.map((row, index) => {
    const storeId = row.storeId ?? "";
    const storeName = row.storeName ?? "";
    const retailerName = row.retailerName ?? "";

    const retailer = retailersByName.get(normalize(retailerName));
    let status;

    if (!retailer) {
      status = IMPORT_STATUS.NEW_RETAILER_AND_STORE;
      newRetailerAndStore++;
      if (retailerName) newRetailerNames.add(retailerName);
    } else if (
      existingStoreKeys.has(storeKey(retailer.id, storeId, storeName))
    ) {
      status = IMPORT_STATUS.EXISTING;
      existingStore++;
    } else {
      status = IMPORT_STATUS.NEW_STORE;
      newStoreOnly++;
    }

    return {
      id: index + 1,
      storeId,
      storeName,
      retailerName,
      retailerId: retailer?.id ?? null,
      status,
      statusLabel: IMPORT_STATUS_LABEL[status],
    };
  });

  return {
    rows: previewRows,
    summary: {
      total: rows.length,
      newRetailerAndStore,
      newStoreOnly,
      existingStore,
      newRetailer: newRetailerNames.size,
      newRetailerNames: Array.from(newRetailerNames),
    },
  };
}
