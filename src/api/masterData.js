/**
 * Vite dev/preview 서버가 server/queries.js로 DB에 직접 조회합니다.
 * (브라우저는 DB에 접속할 수 없어, 같은 프로세스의 Node 미들웨어를 경유합니다.)
 */
const DB_BASE = "/db";

async function fetchJson(path) {
  const res = await fetch(`${DB_BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function fetchRegions() {
  return fetchJson("/regions");
}

export function fetchSubsidiaries(regionId) {
  return fetchJson(
    `/subsidiaries?regionId=${encodeURIComponent(regionId)}`,
  );
}

async function postJson(path, payload) {
  const res = await fetch(`${DB_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function runDryRun(subsidiaryId, rows) {
  return postJson("/dry-run", { subsidiaryId, rows });
}

export function runImport(subsidiaryId, rows) {
  return postJson("/import", { subsidiaryId, rows });
}

export function fetchRetailers(subsidiaryId) {
  return fetchJson(
    `/retailers?subsidiaryId=${encodeURIComponent(subsidiaryId)}`,
  );
}

export function runDeletePreview(retailerIds, deleteRetailers = false) {
  return postJson("/delete-preview", { retailerIds, deleteRetailers });
}

export function runDelete(retailerIds, deleteRetailers = false) {
  return postJson("/delete", { retailerIds, deleteRetailers });
}
