import { useEffect, useMemo, useState } from "react";

const DEFAULT_FORM = {
  companyDomain: "Semiconductor",
  supplierRegions: "Taiwan, South Korea, Japan",
  criticalCommodities: "silicon wafer, photoresist, rare earth",
  supplierNames: "TSMC, Samsung, Intel",
  organizationType: "Manufacturer",
  experienceRiskAppetite: "Balanced",
};

function splitList(value) {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function OnboardingModal({ open, loading, onClose, onSubmit }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(DEFAULT_FORM);
      setError("");
    }
  }, [open]);

  const payload = useMemo(
    () => ({
      company_domain: form.companyDomain.trim(),
      supplier_regions: splitList(form.supplierRegions),
      critical_commodities: splitList(form.criticalCommodities),
      supplier_names: splitList(form.supplierNames),
      organization_type: form.organizationType.trim(),
      experience_risk_appetite: form.experienceRiskAppetite,
    }),
    [form]
  );

  if (!open) {
    return null;
  }

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      await onSubmit(payload);
    } catch (submissionError) {
      setError(submissionError?.message || "Failed to start the onboarding pipeline.");
    }
  }

  return (
    <div className="onboarding-backdrop" role="presentation" onClick={onClose}>
      <div
        className="onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="onboarding-modal__header">
          <div>
            <p className="eyebrow">SME onboarding</p>
            <h2 id="onboarding-title">Configure your supply-risk view</h2>
            <p className="subtle">Use comma-separated values for the list fields. The pipeline will filter the output and sync the session to Neo4j.</p>
          </div>
          <button type="button" className="sidebar-close" onClick={onClose}>
            Close
          </button>
        </div>

        <form className="onboarding-form" onSubmit={handleSubmit}>
          <label>
            <span>Company domain</span>
            <input value={form.companyDomain} onChange={updateField("companyDomain")} placeholder="Semiconductor" />
          </label>

          <label>
            <span>Supplier regions</span>
            <textarea rows={3} value={form.supplierRegions} onChange={updateField("supplierRegions")} placeholder="Taiwan, South Korea, Japan" />
          </label>

          <label>
            <span>Critical commodities</span>
            <textarea rows={3} value={form.criticalCommodities} onChange={updateField("criticalCommodities")} placeholder="silicon wafer, photoresist, rare earth" />
          </label>

          <label>
            <span>Supplier names</span>
            <textarea rows={3} value={form.supplierNames} onChange={updateField("supplierNames")} placeholder="TSMC, Samsung, Intel" />
          </label>

          <label>
            <span>Organization type</span>
            <input value={form.organizationType} onChange={updateField("organizationType")} placeholder="Manufacturer" />
          </label>

          <label>
            <span>Experience / risk appetite</span>
            <select value={form.experienceRiskAppetite} onChange={updateField("experienceRiskAppetite")}>
              <option value="Conservative">Conservative</option>
              <option value="Balanced">Balanced</option>
              <option value="Aggressive">Aggressive</option>
            </select>
          </label>

          {error ? <div className="onboarding-error">{error}</div> : null}

          <div className="onboarding-actions">
            <button type="button" className="cta-link secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="cta" disabled={loading}>
              {loading ? "Running pipeline..." : "Start onboarding"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
