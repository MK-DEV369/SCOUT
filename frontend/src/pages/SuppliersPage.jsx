import { useState } from "react";

export default function SuppliersPage({ suppliers, onSave }) {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [importance, setImportance] = useState(0.5);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await onSave({ name, country, importance: Number(importance) });
    setName("");
    setCountry("");
    setImportance(0.5);
  }

  return (
    <div className="grid two">
      <section className="card">
        <h2>Supplier Profile</h2>
        <form onSubmit={handleSubmit} className="form">
          <label>
            Supplier Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Country
            <input value={country} onChange={(e) => setCountry(e.target.value)} />
          </label>
          <label>
            Importance (0-1)
            <input
              value={importance}
              type="number"
              min="0"
              max="1"
              step="0.1"
              onChange={(e) => setImportance(e.target.value)}
            />
          </label>
          <button className="cta" type="submit">Save Supplier</button>
        </form>
      </section>

      <section className="card">
        <h2>Suppliers</h2>
        <ul className="supplier-list">
          {suppliers.map((s) => (
            <li key={s.id}>
              <strong>{s.name}</strong>
              <span>{s.country || "Unknown"}</span>
              <span>Importance: {s.importance}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
