const STEP_LABELS = {
  add: ["작업 선택", "파일 업로드", "데이터 검수"],
  delete: ["작업 선택", "retailer 선택", "삭제 확인"],
};

export default function StepIndicator({ step, operation }) {
  if (!operation) return null;

  const labels = STEP_LABELS[operation];

  return (
    <div
      style={{
        display: "flex",
        gap: "12px",
        marginBottom: "30px",
        borderBottom: "1px solid #eee",
        paddingBottom: "15px",
        flexWrap: "wrap",
      }}
    >
      {labels.map((label, index) => (
        <span key={label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {index > 0 && <span style={{ color: "#9ca3af" }}>&gt;</span>}
          <span
            style={{
              fontWeight: step === index ? "bold" : "normal",
              color: step === index ? "#4f46e5" : "#9ca3af",
            }}
          >
            {index}. {label}
          </span>
        </span>
      ))}
    </div>
  );
}
