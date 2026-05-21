import { useState } from "react";
import {
  fetchSubsidiaries,
  fetchRetailers,
  runDeletePreview,
  runDelete,
} from "./api/masterData";

const selectStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  fontSize: "14px",
  backgroundColor: "#fff",
  boxSizing: "border-box",
};

export default function DeleteStoresFlow({
  step,
  setStep,
  onBackToHome,
  regions,
  regionsLoading,
  masterError,
  setMasterError,
}) {
  const [regionId, setRegionId] = useState("");
  const [subsidiaryId, setSubsidiaryId] = useState("");
  const [subsidiaries, setSubsidiaries] = useState([]);
  const [subsidiariesLoading, setSubsidiariesLoading] = useState(false);
  const [retailers, setRetailers] = useState([]);
  const [retailersLoading, setRetailersLoading] = useState(false);
  const [selectedRetailerIds, setSelectedRetailerIds] = useState(
    () => new Set(),
  );
  const [deleteRetailers, setDeleteRetailers] = useState(false);
  const [deletePreview, setDeletePreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const selectedSubsidiary = subsidiaries.find(
    (s) => String(s.id) === String(subsidiaryId),
  );

  const handleRegionChange = async (e) => {
    const id = e.target.value;
    setRegionId(id);
    setSubsidiaryId("");
    setSubsidiaries([]);
    setRetailers([]);
    setSelectedRetailerIds(new Set());

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

  const loadRetailers = async (subId) => {
    setRetailersLoading(true);
    setMasterError("");

    try {
      const data = await fetchRetailers(subId);
      setRetailers(data);
      setSelectedRetailerIds(new Set(data.map((r) => r.id)));
    } catch (err) {
      setMasterError(err.message);
      setRetailers([]);
      setSelectedRetailerIds(new Set());
    } finally {
      setRetailersLoading(false);
    }
  };

  const handleSubsidiaryChange = async (e) => {
    const id = e.target.value;
    setSubsidiaryId(id);
    setRetailers([]);
    setSelectedRetailerIds(new Set());

    if (!id) return;
    await loadRetailers(id);
  };

  const selectableRetailers = deleteRetailers
    ? retailers
    : retailers.filter((r) => r.store_count > 0);

  const selectedRetailers = retailers.filter((r) =>
    selectedRetailerIds.has(r.id),
  );
  const selectedStoreCount = selectedRetailers.reduce(
    (sum, r) => sum + r.store_count,
    0,
  );

  const allSelectableSelected =
    selectableRetailers.length > 0 &&
    selectableRetailers.every((r) => selectedRetailerIds.has(r.id));

  const canProceed =
    selectedRetailers.length > 0 &&
    (deleteRetailers || selectedStoreCount > 0);

  const toggleRetailer = (id, checked) => {
    setSelectedRetailerIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSelectAllRetailers = (checked) => {
    if (checked) {
      setSelectedRetailerIds(new Set(selectableRetailers.map((r) => r.id)));
    } else {
      setSelectedRetailerIds(new Set());
    }
  };

  const handleDeleteRetailersToggle = (checked) => {
    setDeleteRetailers(checked);
    if (checked) {
      setSelectedRetailerIds(new Set(retailers.map((r) => r.id)));
    } else {
      setSelectedRetailerIds(
        new Set(
          retailers.filter((r) => r.store_count > 0).map((r) => r.id),
        ),
      );
    }
  };

  const goToPreview = async () => {
    if (!canProceed) {
      alert(
        deleteRetailers
          ? "삭제할 retailer를 하나 이상 선택해 주세요."
          : "삭제할 store가 있는 retailer를 선택해 주세요.",
      );
      return;
    }

    setPreviewLoading(true);
    setMasterError("");

    try {
      const preview = await runDeletePreview(
        selectedRetailers.map((r) => r.id),
        deleteRetailers,
      );
      setDeletePreview({ ...preview, deleteRetailers });
      setStep(2);
    } catch (err) {
      setMasterError(err.message);
      alert(`미리보기 오류: ${err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePreview?.retailers?.length) return;

    const alsoRetailers = deletePreview.deleteRetailers;
    const ok = window.confirm(
      `Subsidiary: ${selectedSubsidiary?.code ?? ""}\n` +
        `대상 retailer: ${deletePreview.retailers.length}개\n` +
        `삭제할 store: ${deletePreview.totalStores}건` +
        (alsoRetailers
          ? `\nretailer 레코드도 ${deletePreview.retailers.length}개 삭제`
          : "\n(retailer는 유지)") +
        `\n\n되돌릴 수 없습니다. 삭제하시겠습니까?`,
    );
    if (!ok) return;

    setDeleteLoading(true);
    setMasterError("");

    try {
      const result = await runDelete(
        deletePreview.retailers.map((r) => r.id),
        alsoRetailers,
      );
      alert(
        `삭제 완료\n` +
          `- store 삭제: ${result.storesDeleted}건` +
          (result.deleteRetailers
            ? `\n- retailer 삭제: ${result.retailersDeleted}개`
            : ""),
      );
      onBackToHome();
    } catch (err) {
      setMasterError(err.message);
      alert(`삭제 실패 (롤백됨): ${err.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
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
              border: "2px dashed #fecaca",
              borderRadius: "8px",
              padding: "32px",
              backgroundColor: "#fef2f2",
            }}
          >
            <h3 style={{ margin: "0 0 8px 0" }}>
              삭제할 retailer를 선택하세요
            </h3>
            <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "12px" }}>
              선택한 retailer 하위의 <strong>모든 store</strong>가 삭제됩니다.
            </p>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "20px",
                fontSize: "14px",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={deleteRetailers}
                onChange={(e) => handleDeleteRetailersToggle(e.target.checked)}
              />
              <span>
                <strong>retailer도 함께 삭제</strong>
                <span style={{ color: "#64748b", marginLeft: "6px" }}>
                  (해제 시 store만 삭제하고 retailer는 유지)
                </span>
              </span>
            </label>

            {masterError && (
              <p
                style={{
                  fontSize: "13px",
                  color: "#dc2626",
                  padding: "10px 12px",
                  backgroundColor: "#fff",
                  borderRadius: "6px",
                  border: "1px solid #fecaca",
                }}
              >
                {masterError}
              </p>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                marginBottom: "20px",
              }}
            >
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                  Region *
                </label>
                <select
                  value={regionId}
                  onChange={handleRegionChange}
                  disabled={regionsLoading}
                  style={selectStyle}
                >
                  <option value="">
                    {regionsLoading ? "불러오는 중..." : "Region 선택"}
                  </option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                  Subsidiary *
                </label>
                <select
                  value={subsidiaryId}
                  onChange={handleSubsidiaryChange}
                  disabled={!regionId || subsidiariesLoading}
                  style={selectStyle}
                >
                  <option value="">
                    {!regionId
                      ? "Region 먼저 선택"
                      : subsidiariesLoading
                        ? "불러오는 중..."
                        : "Subsidiary 선택"}
                  </option>
                  {subsidiaries.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {subsidiaryId && (
              <div
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  overflow: "hidden",
                }}
              >
                {retailersLoading ? (
                  <p style={{ padding: "16px", color: "#64748b" }}>
                    retailer 목록 불러오는 중...
                  </p>
                ) : retailers.length === 0 ? (
                  <p style={{ padding: "16px", color: "#64748b" }}>
                    등록된 retailer가 없습니다.
                  </p>
                ) : (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "14px",
                    }}
                  >
                    <thead>
                      <tr style={{ backgroundColor: "#f8fafc" }}>
                        <th style={{ padding: "10px", width: 44 }}>
                          <input
                            type="checkbox"
                            checked={allSelectableSelected}
                            disabled={selectableRetailers.length === 0}
                            onChange={(e) =>
                              handleSelectAllRetailers(e.target.checked)
                            }
                          />
                        </th>
                        <th style={{ padding: "10px", textAlign: "left" }}>
                          Retailer
                        </th>
                        <th style={{ padding: "10px", textAlign: "right" }}>
                          Store 수
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {retailers.map((r) => {
                        const canSelect =
                          deleteRetailers || r.store_count > 0;
                        return (
                          <tr
                            key={r.id}
                            style={{
                              borderTop: "1px solid #e2e8f0",
                              opacity: canSelect ? 1 : 0.5,
                            }}
                          >
                            <td style={{ padding: "10px", textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={
                                  canSelect && selectedRetailerIds.has(r.id)
                                }
                                disabled={!canSelect}
                                onChange={(e) =>
                                  toggleRetailer(r.id, e.target.checked)
                                }
                              />
                            </td>
                            <td style={{ padding: "10px" }}>{r.name}</td>
                            <td
                              style={{
                                padding: "10px",
                                textAlign: "right",
                                color: "#64748b",
                              }}
                            >
                              {r.store_count}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div
              style={{
                marginTop: "20px",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={goToPreview}
                disabled={!subsidiaryId || !canProceed || previewLoading}
                style={{
                  padding: "10px 20px",
                  backgroundColor: canProceed ? "#dc2626" : "#94a3b8",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: canProceed ? "pointer" : "not-allowed",
                  fontWeight: "bold",
                }}
              >
                {previewLoading
                  ? "확인 중..."
                  : deleteRetailers
                    ? `삭제 검수 (${selectedRetailers.length} retailer)`
                    : `삭제 검수 (${selectedStoreCount}건 store)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && deletePreview && (
        <div>
          <div style={{ marginBottom: "16px" }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                padding: "6px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "4px",
                backgroundColor: "#fff",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              ← retailer 선택
            </button>
          </div>

          <div
            style={{
              padding: "24px",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              backgroundColor: "#fef2f2",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", color: "#b91c1c" }}>
              삭제 확인
            </h3>
            <p style={{ margin: "0 0 12px 0" }}>
              Subsidiary: <strong>{selectedSubsidiary?.code}</strong>
            </p>
            <p style={{ margin: "0 0 8px 0" }}>
              총 <strong>{deletePreview.retailers.length}</strong>개 retailer ·{" "}
              <strong>{deletePreview.totalStores}</strong>건 store 삭제 예정
            </p>
            <p style={{ margin: "0 0 16px 0", color: "#64748b", fontSize: "14px" }}>
              {deletePreview.deleteRetailers
                ? "선택한 retailer 레코드도 함께 삭제됩니다."
                : "retailer 레코드는 유지됩니다."}
            </p>

            <ul
              style={{
                margin: "0 0 20px 0",
                paddingLeft: "20px",
                maxHeight: "240px",
                overflowY: "auto",
              }}
            >
              {deletePreview.retailers.map((r) => (
                <li key={r.id} style={{ marginBottom: "4px" }}>
                  {r.name} — store {r.store_count}건
                </li>
              ))}
            </ul>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  padding: "10px 16px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#fff",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                style={{
                  padding: "10px 16px",
                  backgroundColor: "#dc2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: deleteLoading ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                }}
              >
                {deleteLoading
                  ? "삭제 중..."
                  : deletePreview.deleteRetailers
                    ? "store·retailer 삭제 실행"
                    : "store 삭제 실행"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
