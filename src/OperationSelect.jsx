const cardStyle = (active) => ({
  flex: 1,
  minWidth: "220px",
  padding: "28px 24px",
  borderRadius: "8px",
  border: active ? "2px solid #4f46e5" : "2px solid #e2e8f0",
  backgroundColor: active ? "#eef2ff" : "#fff",
  cursor: "pointer",
  textAlign: "left",
});

export default function OperationSelect({ onSelect }) {
  return (
    <div>
      <h3 style={{ margin: "0 0 8px 0", textAlign: "center" }}>
        작업을 선택해 주세요
      </h3>
      <p
        style={{
          textAlign: "center",
          color: "#64748b",
          fontSize: "14px",
          marginBottom: "28px",
        }}
      >
        엑셀 기반 데이터 추가 또는 retailer 하위 store 일괄 삭제
      </p>
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => onSelect("add")}
          style={cardStyle(false)}
        >
          <div
            style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "8px" }}
          >
            데이터 추가
          </div>
          <div style={{ fontSize: "14px", color: "#64748b" }}>
            엑셀 업로드 → retailer·store 등록
          </div>
        </button>
        <button
          type="button"
          onClick={() => onSelect("delete")}
          style={cardStyle(false)}
        >
          <div
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: "8px",
              color: "#b91c1c",
            }}
          >
            데이터 삭제
          </div>
          <div style={{ fontSize: "14px", color: "#64748b" }}>
            retailer 선택 → store 삭제 (옵션: retailer 삭제)
          </div>
        </button>
      </div>
    </div>
  );
}
