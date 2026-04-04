export default function AlertsPage({ alerts }) {
  return (
    <section className="card full">
      <h2>Ranked Disruption Alerts</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Alert Level</th>
              <th>Risk Score</th>
              <th>Event Id</th>
              <th>Severity</th>
              <th>Recency</th>
              <th>Credibility</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((row) => (
              <tr key={row.risk_id}>
                <td><span className={`pill ${row.alert_level.toLowerCase()}`}>{row.alert_level}</span></td>
                <td>{row.risk_score.toFixed(3)}</td>
                <td>{row.event_id}</td>
                <td>{row.features?.severity ?? "-"}</td>
                <td>{row.features?.recency ?? "-"}</td>
                <td>{row.features?.credibility ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
