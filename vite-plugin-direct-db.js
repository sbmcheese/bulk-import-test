import {
  getRegions,
  getSubsidiaries,
  pingDb,
  runImportDryRun,
  runBulkImport,
  getRetailersWithStoreCount,
  getDeletePreview,
  runBulkDelete,
} from "./server/queries.js";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function readQueryParam(url, key) {
  return new URL(url, "http://localhost").searchParams.get(key);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

/** Vite dev/preview 서버에서 pg로 직접 조회 (별도 API 서버 없음) */
export function directDbPlugin() {
  const handler = async (req, res, next) => {
    const { method, url } = req;
    if (!url) return next();

    try {
      if (method === "GET") {
        if (url === "/db/health" || url.startsWith("/db/health?")) {
          sendJson(res, 200, await pingDb());
          return;
        }

        if (url === "/db/regions" || url.startsWith("/db/regions?")) {
          sendJson(res, 200, await getRegions());
          return;
        }

        if (url.startsWith("/db/subsidiaries")) {
          const regionId = readQueryParam(url, "regionId");
          if (!regionId) {
            sendJson(res, 400, {
              message: "regionId query parameter is required",
            });
            return;
          }
          sendJson(res, 200, await getSubsidiaries(regionId));
          return;
        }

        if (url.startsWith("/db/retailers")) {
          const subsidiaryId = readQueryParam(url, "subsidiaryId");
          if (!subsidiaryId) {
            sendJson(res, 400, {
              message: "subsidiaryId query parameter is required",
            });
            return;
          }
          sendJson(res, 200, await getRetailersWithStoreCount(subsidiaryId));
          return;
        }
      }

      if (method === "POST" && url === "/db/dry-run") {
        const body = await readJsonBody(req);
        if (!body.subsidiaryId) {
          sendJson(res, 400, { message: "subsidiaryId is required" });
          return;
        }
        if (!Array.isArray(body.rows)) {
          sendJson(res, 400, { message: "rows array is required" });
          return;
        }
        sendJson(res, 200, await runImportDryRun(body.subsidiaryId, body.rows));
        return;
      }

      if (method === "POST" && url === "/db/import") {
        const body = await readJsonBody(req);
        if (!body.subsidiaryId) {
          sendJson(res, 400, { message: "subsidiaryId is required" });
          return;
        }
        if (!Array.isArray(body.rows)) {
          sendJson(res, 400, { message: "rows array is required" });
          return;
        }
        sendJson(res, 200, await runBulkImport(body.subsidiaryId, body.rows));
        return;
      }

      if (method === "POST" && url === "/db/delete-preview") {
        const body = await readJsonBody(req);
        if (!Array.isArray(body.retailerIds)) {
          sendJson(res, 400, { message: "retailerIds array is required" });
          return;
        }
        sendJson(res, 200, await getDeletePreview(body.retailerIds));
        return;
      }

      if (method === "POST" && url === "/db/delete") {
        const body = await readJsonBody(req);
        if (!Array.isArray(body.retailerIds)) {
          sendJson(res, 400, { message: "retailerIds array is required" });
          return;
        }
        sendJson(
          res,
          200,
          await runBulkDelete(body.retailerIds, {
            deleteRetailers: Boolean(body.deleteRetailers),
          }),
        );
        return;
      }
    } catch (err) {
      console.error("[direct-db]", method, url, err);
      sendJson(res, 500, { message: err.message });
      return;
    }

    next();
  };

  return {
    name: "direct-db",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
