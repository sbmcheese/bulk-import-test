import { useState } from "react";
import * as XLSX from "xlsx";
import { fetchSubsidiaries, runDryRun, runImport } from "./api/masterData";

const IMPORT_STATUS = {
  NEW_RETAILER_AND_STORE: "NEW_RETAILER_AND_STORE",
  NEW_STORE: "NEW_STORE",
  EXISTING: "EXISTING",
};

function getDefaultSelectedIds(rows) {
  return new Set(
    rows
      .filter((r) => r.status !== IMPORT_STATUS.EXISTING)
      .map((r) => r.id),
  );
}

function isRowSelectable(row) {
  return row.status !== IMPORT_STATUS.EXISTING;
}

const STATUS_STYLE = {
  NEW_RETAILER_AND_STORE: {
    bg: "#fef3c7",
    color: "#d97706",
    rowBg: "#fffbeb",
  },
  NEW_STORE: {
    bg: "#dbeafe",
    color: "#1d4ed8",
    rowBg: "#eff6ff",
  },
  EXISTING: {
    bg: "#dcfce7",
    color: "#15803d",
    rowBg: "#fff",
  },
};

function getCell(row, ...keys) {
  for (const key of keys) {
    const val = row[key];
    if (val != null && String(val).trim() !== "") {
      return String(val).trim();
    }
  }
  return "";
}

const selectStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  fontSize: "14px",
  backgroundColor: "#fff",
  boxSizing: "border-box",
};

export default function AddImportFlow({
  step,
  setStep,
  onBackToHome,
  regions,
  regionsLoading,
  masterError,
  setMasterError,
}) {
  const [file, setFile] = useState(null);
  const [regionId, setRegionId] = useState("");
  const [subsidiaryId, setSubsidiaryId] = useState("");
  const [subsidiaries, setSubsidiaries] = useState([]);
  const [subsidiariesLoading, setSubsidiariesLoading] = useState(false);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [selectedRowIds, setSelectedRowIds] = useState(() => new Set());
  const [summary, setSummary] = useState({
    total: 0,
    newRetailerAndStore: 0,
    newStoreOnly: 0,
    existingStore: 0,
    newRetailer: 0,
    newRetailerNames: [],
    subsidiaryCode: "",
  });

  const handleRegionChange = async (e) => {
    const id = e.target.value;
    setRegionId(id);
    setSubsidiaryId("");
    setSubsidiaries([]);

    if (!id) {
      setSubsidiariesLoading(false);
      return;
    }

    setSubsidiariesLoading(true);
    setMasterError("");

    try {
      const data = await fetchSubsidiaries(id);
      setSubsidiaries(data);
    } catch (err) {
      setMasterError(err.message);
      setSubsidiaries([]);
    } finally {
      setSubsidiariesLoading(false);
    }
  };

  const selectedSubsidiary = subsidiaries.find(
    (s) => String(s.id) === String(subsidiaryId),
  );

  const resetUpload = () => {
    setStep(1);
    setFile(null);
    setPreviewData([]);
    setSelectedRowIds(new Set());
    setRegionId("");
    setSubsidiaryId("");
    setSubsidiaries([]);
    setMasterError("");
    setSummary({
      total: 0,
      newRetailerAndStore: 0,
      newStoreOnly: 0,
      existingStore: 0,
      newRetailer: 0,
      newRetailerNames: [],
      subsidiaryCode: "",
    });
  };

  const parseExcelRows = (sheet) => {
    const rawRows = XLSX.utils.sheet_to_json(sheet);
    return rawRows.map((row) => ({
      storeId: getCell(row, "storeId", "Store Id", "Store ID", "store_id"),
      storeName:
        getCell(row, "storeName", "Store Name", "store_name") || "이름 없음",
      retailerName: getCell(
        row,
        "retailerName",
        "Retailer Name",
        "retailer_name",
      ),
    }));
  };

  // 1. 엑셀 파싱 후 DB dry-run 검증
  const handleFileChange = (e) => {
    if (!selectedSubsidiary?.id) {
      alert("Region과 Subsidiary를 선택해 주세요.");
      e.target.value = "";
      return;
    }

    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = parseExcelRows(sheet);

        setDryRunLoading(true);
        setMasterError("");

        const result = await runDryRun(selectedSubsidiary.id, rows);
        setPreviewData(result.rows);
        setSelectedRowIds(getDefaultSelectedIds(result.rows));
        setSummary({
          ...result.summary,
          subsidiaryCode: selectedSubsidiary.code,
        });
        setStep(2);
      } catch (err) {
        setMasterError(err.message);
        alert(`검증 중 오류: ${err.message}`);
        e.target.value = "";
        setFile(null);
      } finally {
        setDryRunLoading(false);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const selectableRows = previewData.filter(isRowSelectable);
  const selectedImportableCount = selectableRows.filter((row) =>
    selectedRowIds.has(row.id),
  ).length;
  const allSelectableSelected =
    selectableRows.length > 0 &&
    selectableRows.every((row) => selectedRowIds.has(row.id));

  const toggleRowSelection = (rowId, checked) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(rowId);
      else next.delete(rowId);
      return next;
    });
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedRowIds(new Set(selectableRows.map((row) => row.id)));
    } else {
      setSelectedRowIds(new Set());
    }
  };

  const handleFinalSubmit = async () => {
    if (!selectedSubsidiary?.id) return;

    if (selectedImportableCount === 0) {
      alert("등록할 행을 하나 이상 선택해 주세요.");
      return;
    }

    const ok = window.confirm(
      `Subsidiary: ${summary.subsidiaryCode}\n` +
        `선택한 store: ${selectedImportableCount}건\n\n` +
        `DB에 반영하시겠습니까? (단일 트랜잭션)`,
    );
    if (!ok) return;

    const rowsToImport = previewData
      .filter((row) => isRowSelectable(row) && selectedRowIds.has(row.id))
      .map((row) => ({
        storeId: row.storeId,
        storeName: row.storeName,
        retailerName: row.retailerName,
      }));

    setImportLoading(true);
    setMasterError("");

    try {
      const result = await runImport(selectedSubsidiary.id, rowsToImport);
      alert(
        `등록 완료\n` +
          `- retailer 생성: ${result.retailersCreated}개\n` +
          `- store 생성: ${result.storesCreated}건\n` +
          `- 건너뜀(중복): ${result.skipped}건`,
      );
      resetUpload();
    } catch (err) {
      setMasterError(err.message);
      alert(`등록 실패 (롤백됨): ${err.message}`);
    } finally {
      setImportLoading(false);
    }
  };

  const canUpload = Boolean(selectedSubsidiary?.id) && !dryRunLoading;
  const canImport = selectedImportableCount > 0 && !importLoading;

  return (
    <>
      {/* Step 1: region / subsidiary 선택 + 파일 업로드 */}
      {step === 1 && (
        <div>
          <div style={{ marginBottom: "16px" }}>
            <button
              type="button"
              onClick={onBackToHome}
              style={{
                padding: "6px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "4px",
                backgroundColor: "#fff",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              ← 작업 선택
            </button>
          </div>
        <div
          style={{
            border: "2px dashed #cbd5e1",
            borderRadius: "8px",
            padding: "40px",
            backgroundColor: "#f8fafc",
          }}
        >
          <h3 style={{ margin: "0 0 10px 0", textAlign: "center" }}>
            매장 대량 등록을 위한 엑셀 파일을 올려주세요
          </h3>
          <p
            style={{
              color: "#64748b",
              fontSize: "14px",
              marginBottom: "24px",
              textAlign: "center",
            }}
          >
            region → subsidiary → retailer → store 계층 중, 업로드 대상
            retailer·store는 선택한 subsidiary 하위로 등록됩니다.
            <br />
            지원 확장자: .xlsx, .xls, .csv · 헤더:{" "}
            <code>storeId</code>, <code>storeName</code>,{" "}
            <code>retailerName</code>
          </p>

          <div
            style={{
              maxWidth: "400px",
              margin: "0 auto 28px",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {masterError && (
              <p
                style={{
                  fontSize: "13px",
                  color: "#dc2626",
                  padding: "10px 12px",
                  backgroundColor: "#fef2f2",
                  borderRadius: "6px",
                  border: "1px solid #fecaca",
                  margin: 0,
                }}
              >
                DB 조회 오류: {masterError}
                <br />
                <span style={{ color: "#64748b" }}>
                  npm run dev 실행 및 .env DB 설정을 확인해 주세요.
                </span>
              </p>
            )}

            <div>
              <label
                htmlFor="region-select"
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  marginBottom: "8px",
                  color: "#334155",
                }}
              >
                Region <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <select
                id="region-select"
                value={regionId}
                onChange={handleRegionChange}
                disabled={regionsLoading}
                style={selectStyle}
              >
                <option value="">
                  {regionsLoading ? "불러오는 중..." : "Region을 선택하세요"}
                </option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="subsidiary-select"
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  marginBottom: "8px",
                  color: "#334155",
                }}
              >
                Subsidiary <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <select
                id="subsidiary-select"
                value={subsidiaryId}
                onChange={(e) => setSubsidiaryId(e.target.value)}
                disabled={!regionId || subsidiariesLoading}
                style={selectStyle}
              >
                <option value="">
                  {!regionId
                    ? "먼저 Region을 선택하세요"
                    : subsidiariesLoading
                      ? "불러오는 중..."
                      : subsidiaries.length === 0
                        ? "해당 Region에 subsidiary 없음"
                        : "Subsidiary를 선택하세요"}
                </option>
                {subsidiaries.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              style={{ display: "none" }}
              id="excel-upload"
              disabled={!canUpload}
            />
            <label
              htmlFor="excel-upload"
              style={{
                padding: "10px 20px",
                backgroundColor: canUpload ? "#4f46e5" : "#94a3b8",
                color: "#fff",
                borderRadius: "4px",
                cursor: canUpload ? "pointer" : "not-allowed",
                display: "inline-block",
              }}
            >
              파일 선택하기
            </label>
            {!canUpload && (
              <p
                style={{
                  fontSize: "13px",
                  color: "#dc2626",
                  marginTop: "12px",
                }}
              >
                파일 업로드 전에 Region과 Subsidiary를 선택해 주세요.
              </p>
            )}
            {dryRunLoading && (
              <p style={{ fontSize: "13px", color: "#4338ca", marginTop: "12px" }}>
                DB에서 retailer·store 매칭 검증 중...
              </p>
            )}
            {file && !dryRunLoading && (
              <p style={{ fontSize: "13px", color: "#64748b", marginTop: "8px" }}>
                선택된 파일: {file.name}
              </p>
            )}
          </div>
        </div>
        </div>
      )}

      {/* Step 2: 데이터 확인 (Dry-run 결과 화면) */}
      {step === 2 && (
        <div>
          <div style={{ marginBottom: "16px" }}>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setFile(null);
                setPreviewData([]);
                setSelectedRowIds(new Set());
              }}
              style={{
                padding: "6px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "4px",
                backgroundColor: "#fff",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              ← 파일 업로드
            </button>
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              marginBottom: "20px",
              backgroundColor: "#eef2ff",
              border: "1px solid #c7d2fe",
              borderRadius: "6px",
              fontSize: "14px",
            }}
          >
            <span style={{ color: "#64748b" }}>적용 법인</span>
            <strong style={{ color: "#4338ca" }}>
              {summary.subsidiaryCode}
            </strong>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                padding: "16px",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                backgroundColor: "#f1f5f9",
              }}
            >
              <div style={{ fontSize: "14px", color: "#64748b" }}>총 행 수</div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  marginTop: "4px",
                }}
              >
                {summary.total} 건
              </div>
            </div>
            <div
              style={{
                padding: "16px",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                backgroundColor:
                  summary.newRetailerAndStore > 0 ? "#fff7ed" : "#f8fafc",
              }}
            >
              <div style={{ fontSize: "14px", color: "#9a3412" }}>
                Retailer/Store 추가
              </div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  marginTop: "4px",
                  color: "#9a3412",
                }}
              >
                {summary.newRetailerAndStore} 건
              </div>
              {summary.newRetailerNames.length > 0 && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#c2410c",
                    marginTop: "4px",
                  }}
                >
                  신규 retailer: {summary.newRetailerNames.join(", ")}
                </div>
              )}
            </div>
            <div
              style={{
                padding: "16px",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                backgroundColor:
                  summary.newStoreOnly > 0 ? "#eff6ff" : "#f8fafc",
              }}
            >
              <div style={{ fontSize: "14px", color: "#1d4ed8" }}>
                Store 추가
              </div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  marginTop: "4px",
                  color: "#1d4ed8",
                }}
              >
                {summary.newStoreOnly} 건
              </div>
            </div>
            <div
              style={{
                padding: "16px",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                backgroundColor: "#f0fdf4",
              }}
            >
              <div style={{ fontSize: "14px", color: "#166534" }}>
                중복
              </div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  marginTop: "4px",
                  color: "#166534",
                }}
              >
                {summary.existingStore} 건
              </div>
            </div>
          </div>

          <h4 style={{ marginBottom: "10px" }}>
            업로드 데이터 미리보기
            <span
              style={{
                marginLeft: "8px",
                fontSize: "13px",
                fontWeight: "normal",
                color: "#64748b",
              }}
            >
              ({selectedImportableCount}/{selectableRows.length}건 선택)
            </span>
          </h4>
          <div
            style={{
              overflowX: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              marginBottom: "20px",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: "14px",
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <th style={{ padding: "12px", width: "44px" }}>
                    <input
                      type="checkbox"
                      checked={allSelectableSelected}
                      disabled={selectableRows.length === 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      title="등록 가능한 행 전체 선택"
                    />
                  </th>
                  <th style={{ padding: "12px" }}>#</th>
                  <th style={{ padding: "12px" }}>Store ID</th>
                  <th style={{ padding: "12px" }}>Store Name</th>
                  <th style={{ padding: "12px" }}>Retailer Name</th>
                  <th style={{ padding: "12px" }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {previewData.map((row) => {
                  const style = STATUS_STYLE[row.status] ?? STATUS_STYLE.EXISTING;
                  const selectable = isRowSelectable(row);
                  const checked = selectedRowIds.has(row.id);
                  return (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: "1px solid #e2e8f0",
                      backgroundColor: style.rowBg,
                      opacity: selectable && !checked ? 0.55 : 1,
                    }}
                  >
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectable && checked}
                        disabled={!selectable}
                        onChange={(e) =>
                          toggleRowSelection(row.id, e.target.checked)
                        }
                        title={
                          selectable
                            ? "등록 포함"
                            : "기존 매장(중복) — 선택 불가"
                        }
                      />
                    </td>
                    <td style={{ padding: "12px", color: "#64748b" }}>
                      {row.id}
                    </td>
                    <td
                      style={{
                        padding: "12px",
                        fontFamily: "monospace",
                        fontSize: "13px",
                      }}
                    >
                      {row.storeId || "—"}
                    </td>
                    <td style={{ padding: "12px", fontWeight: "500" }}>
                      {row.storeName}
                    </td>
                    <td style={{ padding: "12px" }}>{row.retailerName}</td>
                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          padding: "2px 6px",
                          backgroundColor: style.bg,
                          color: style.color,
                          borderRadius: "4px",
                          fontSize: "12px",
                          whiteSpace: "nowrap",
                          fontWeight:
                            row.status === "NEW_RETAILER_AND_STORE"
                              ? "bold"
                              : "normal",
                        }}
                      >
                        {row.statusLabel}
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}
          >
            <button
              onClick={() => {
                setStep(1);
                setFile(null);
                setPreviewData([]);
                setSelectedRowIds(new Set());
              }}
              style={{
                padding: "10px 16px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#fff",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              취소 후 다시 올리기
            </button>
            <button
              onClick={handleFinalSubmit}
              disabled={!canImport}
              style={{
                padding: "10px 16px",
                backgroundColor: canImport ? "#4f46e5" : "#94a3b8",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: canImport ? "pointer" : "not-allowed",
                fontWeight: "bold",
              }}
            >
              {importLoading
                ? "등록 중..."
                : `확인 및 최종 매장 등록 (${selectedImportableCount}건)`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
