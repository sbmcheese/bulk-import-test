import { useEffect, useState } from "react";
import { fetchRegions } from "./api/masterData";
import AddImportFlow from "./AddImportFlow";
import DeleteStoresFlow from "./DeleteStoresFlow";
import OperationSelect from "./OperationSelect";
import StepIndicator from "./StepIndicator";

export default function BulkImportTest() {
  const [step, setStep] = useState(0);
  const [operation, setOperation] = useState(null);
  const [regions, setRegions] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [masterError, setMasterError] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetchRegions()
      .then((data) => {
        if (!cancelled) setRegions(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setMasterError(err.message);
          setRegions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setRegionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectOperation = (op) => {
    setOperation(op);
    setStep(1);
    setMasterError("");
  };

  const handleBackToHome = () => {
    setStep(0);
    setOperation(null);
    setMasterError("");
  };

  return (
    <div
      style={{
        padding: "24px",
        fontFamily: "sans-serif",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      <StepIndicator step={step} operation={operation} />

      {step === 0 && <OperationSelect onSelect={handleSelectOperation} />}

      {operation === "add" && step > 0 && (
        <AddImportFlow
          step={step}
          setStep={setStep}
          onBackToHome={handleBackToHome}
          regions={regions}
          regionsLoading={regionsLoading}
          masterError={masterError}
          setMasterError={setMasterError}
        />
      )}

      {operation === "delete" && step > 0 && (
        <DeleteStoresFlow
          step={step}
          setStep={setStep}
          onBackToHome={handleBackToHome}
          regions={regions}
          regionsLoading={regionsLoading}
          masterError={masterError}
          setMasterError={setMasterError}
        />
      )}
    </div>
  );
}
