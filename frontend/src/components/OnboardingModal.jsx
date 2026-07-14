import { useEffect, useMemo, useState } from "react";

const DEFAULT_FORM = {
  organizationName: "",
  companyDomain: "Semiconductor",
  industryDomain: "Semiconductor",
  country: "Taiwan",
  operationalRegions: "Taiwan, South Korea, Japan",
  supplierRegions: "Taiwan, South Korea, Japan",
  criticalCommodities: "silicon wafer, photoresist, rare earth",
  supplierNames: "TSMC, Samsung, Intel",
  criticalSuppliers: "TSMC, Samsung, Intel",
  supplierCountries: "Taiwan, South Korea, United States",
  criticalPorts: "Rotterdam, Singapore, Kaohsiung",
  riskAppetite: "Balanced",
  alertSensitivity: "High",
  preferredAlertCategories: "geopolitical, logistics, economic",
  role: "Analyst",
  experienceLevel: "Intermediate",
  operationalResponsibility: "Procurement and supply continuity",
  organizationType: "Manufacturer",
  experienceRiskAppetite: "Balanced",
};

function splitList(value) {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const PRESETS = {
  Semiconductor: {
    organizationName: "GlobalSemi Corp",
    companyDomain: "Semiconductor",
    industryDomain: "Semiconductor",
    country: "Taiwan",
    operationalRegions: "Taiwan, South Korea, Japan",
    supplierRegions: "Taiwan, South Korea, Japan, United States",
    criticalCommodities: "silicon wafer, photoresist, rare earth, lithography chemicals",
    supplierNames: "TSMC, Samsung, Intel, ASML",
    criticalSuppliers: "TSMC, Samsung, Intel, ASML",
    supplierCountries: "Taiwan, South Korea, United States, Netherlands",
    criticalPorts: "Rotterdam, Singapore, Kaohsiung",
    riskAppetite: "Balanced",
    alertSensitivity: "High",
    preferredAlertCategories: "geopolitical, logistics, economic",
    role: "Analyst",
    experienceLevel: "Intermediate",
    operationalResponsibility: "Procurement and supply continuity",
    organizationType: "Manufacturer",
    experienceRiskAppetite: "Balanced",
  },
  "Ethanol Fuel": {
    organizationName: "EcoFuel Global",
    companyDomain: "Ethanol Fuel",
    industryDomain: "Ethanol Fuel",
    country: "United States",
    operationalRegions: "United States, Brazil, Germany",
    supplierRegions: "United States, Brazil, India, Germany",
    criticalCommodities: "corn feedstock, sugarcane, anhydrous ethanol, denaturants",
    supplierNames: "ADM, POET, Valero, Cosan",
    criticalSuppliers: "ADM, POET, Valero, Cosan",
    supplierCountries: "United States, Brazil, India, Germany",
    criticalPorts: "Houston, Santos, Rotterdam, Paranagua",
    riskAppetite: "Balanced",
    alertSensitivity: "High",
    preferredAlertCategories: "economic, logistics, environmental",
    role: "Operations Manager",
    experienceLevel: "Intermediate",
    operationalResponsibility: "Biofuel feedstock logistics and hedging",
    organizationType: "Refiner",
    experienceRiskAppetite: "Balanced",
  },
  "EV Battery": {
    organizationName: "VoltDrive Systems",
    companyDomain: "EV Battery",
    industryDomain: "EV Battery",
    country: "Germany",
    operationalRegions: "Germany, China, United States",
    supplierRegions: "China, Australia, Chile, Indonesia, Canada",
    criticalCommodities: "lithium carbonate, cobalt sulfate, battery grade nickel, synthetic graphite",
    supplierNames: "CATL, LG Energy, Panasonic, BYD",
    criticalSuppliers: "CATL, LG Energy, Panasonic, BYD",
    supplierCountries: "China, South Korea, Japan, Australia, Indonesia",
    criticalPorts: "Shanghai, Busan, Ningbo, Vancouver",
    riskAppetite: "Conservative",
    alertSensitivity: "Critical",
    preferredAlertCategories: "geopolitical, economic, logistics, mining",
    role: "Strategic Sourcing Director",
    experienceLevel: "Advanced",
    operationalResponsibility: "Critical minerals procurement security",
    organizationType: "Automotive OEM",
    experienceRiskAppetite: "Conservative",
  }
};

export default function OnboardingModal({ open, loading, onClose, onSubmit }) {
  const [form, setForm] = useState(PRESETS.Semiconductor);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(PRESETS.Semiconductor);
      setError("");
    }
  }, [open]);

  const payload = useMemo(
    () => ({
      organization_name: form.organizationName.trim(),
      company_domain: form.companyDomain.trim(),
      industry_domain: form.industryDomain.trim(),
      country: form.country.trim(),
      operational_regions: splitList(form.operationalRegions),
      supplier_regions: splitList(form.supplierRegions),
      critical_commodities: splitList(form.criticalCommodities),
      supplier_names: splitList(form.supplierNames),
      critical_suppliers: splitList(form.criticalSuppliers),
      supplier_countries: splitList(form.supplierCountries),
      critical_ports: splitList(form.criticalPorts),
      risk_appetite: form.riskAppetite,
      alert_sensitivity: form.alertSensitivity,
      preferred_alert_categories: splitList(form.preferredAlertCategories),
      role: form.role,
      experience_level: form.experienceLevel,
      operational_responsibility: form.operationalResponsibility,
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
      setError(submissionError?.message || "Failed to run onboarding intelligence retrieval.");
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
            <p className="subtle">Use comma-separated values for the list fields. Onboarding retrieves intelligence from existing processed data.</p>
          </div>
          <button type="button" className="sidebar-close" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Quick Presets Selector */}
        <div style={{
          background: "rgba(6, 214, 160, 0.05)",
          border: "1px solid rgba(6, 214, 160, 0.2)",
          borderRadius: "12px",
          padding: "15px",
          margin: "0 24px 20px 24px"
        }}>
          <p style={{ margin: "0 0 10px 0", fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>
            Select a Quick Test Preset:
          </p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {Object.keys(PRESETS).map((key) => {
              const isActive = form.industryDomain === PRESETS[key].industryDomain;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm(PRESETS[key])}
                  className={`chip ${isActive ? "active" : ""}`}
                  style={{
                    cursor: "pointer",
                    padding: "8px 16px",
                    borderRadius: "20px",
                    background: isActive ? "var(--aqua)" : "rgba(255, 255, 255, 0.03)",
                    color: isActive ? "#08111f" : "#eff5ff",
                    border: "1px solid " + (isActive ? "var(--aqua)" : "var(--line)"),
                    fontWeight: "600",
                    fontSize: "0.85rem",
                    transition: "all 0.3s ease"
                  }}
                >
                  {key}
                </button>
              );
            })}
          </div>
        </div>

        <form className="onboarding-form" onSubmit={handleSubmit}>
          <div className="onboarding-section">
            <h3>Company details</h3>
            <label>
              <span>Organization name</span>
              <input value={form.organizationName} onChange={updateField("organizationName")} placeholder="SCOUT Industries" />
            </label>

            <label>
              <span>Industry domain</span>
              <input value={form.industryDomain} onChange={updateField("industryDomain")} placeholder="Semiconductor" />
            </label>

            <label>
              <span>Country</span>
              <input value={form.country} onChange={updateField("country")} placeholder="Taiwan" />
            </label>

            <label>
              <span>Operational regions</span>
              <textarea rows={3} value={form.operationalRegions} onChange={updateField("operationalRegions")} placeholder="Taiwan, South Korea, Japan" />
            </label>
          </div>

          <div className="onboarding-section">
            <h3>Supplier details</h3>
            <label>
              <span>Critical suppliers</span>
              <textarea rows={3} value={form.criticalSuppliers} onChange={updateField("criticalSuppliers")} placeholder="TSMC, Samsung, Intel" />
            </label>

            <label>
              <span>Supplier countries</span>
              <textarea rows={3} value={form.supplierCountries} onChange={updateField("supplierCountries")} placeholder="Taiwan, South Korea, United States" />
            </label>

            <label>
              <span>Critical ports</span>
              <textarea rows={3} value={form.criticalPorts} onChange={updateField("criticalPorts")} placeholder="Rotterdam, Singapore, Kaohsiung" />
            </label>

            <label>
              <span>Critical commodities</span>
              <textarea rows={3} value={form.criticalCommodities} onChange={updateField("criticalCommodities")} placeholder="silicon wafer, photoresist, rare earth" />
            </label>
          </div>

          <div className="onboarding-section">
            <h3>Risk preferences</h3>
            <label>
              <span>Risk appetite</span>
              <select value={form.riskAppetite} onChange={updateField("riskAppetite")}> 
                <option value="Conservative">Conservative</option>
                <option value="Balanced">Balanced</option>
                <option value="Aggressive">Aggressive</option>
              </select>
            </label>

            <label>
              <span>Alert sensitivity</span>
              <select value={form.alertSensitivity} onChange={updateField("alertSensitivity")}> 
                <option value="Low">Low</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </label>

            <label>
              <span>Preferred alert categories</span>
              <textarea rows={3} value={form.preferredAlertCategories} onChange={updateField("preferredAlertCategories")} placeholder="geopolitical, logistics, economic" />
            </label>
          </div>

          <div className="onboarding-section">
            <h3>User experience</h3>
            <label>
              <span>Role</span>
              <input value={form.role} onChange={updateField("role")} placeholder="Analyst" />
            </label>

            <label>
              <span>Experience level</span>
              <select value={form.experienceLevel} onChange={updateField("experienceLevel")}>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </label>

            <label>
              <span>Operational responsibility</span>
              <textarea rows={3} value={form.operationalResponsibility} onChange={updateField("operationalResponsibility")} placeholder="Procurement and supply continuity" />
            </label>
          </div>

          <label>
            <span>Company domain</span>
            <input value={form.companyDomain} onChange={updateField("companyDomain")} placeholder="Semiconductor" />
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
              {loading ? "Retrieving intelligence..." : "Start onboarding"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
