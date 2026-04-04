export default function TeamsPage() {
  const members = [
    { role: "AI/ML Student", name: "Placeholder AIML 1", stream: "AIML" },
    { role: "AI/ML Student", name: "Placeholder AIML 2", stream: "AIML" },
    { role: "CS Student", name: "Placeholder CS 1", stream: "CS" },
    { role: "IS Student", name: "Placeholder IS 1", stream: "IS" },
    { role: "IS Student", name: "Placeholder IS 2", stream: "IS" },
  ];

  return (
    <section className="card full">
      <h2>Project Team</h2>
      <p className="subtle">5 placeholders: 2 AIML, 1 CS, 2 IS.</p>
      <div className="team-grid">
        {members.map((member, index) => (
          <article className="team-card" key={`${member.role}-${index}`}>
            <h3>{member.name}</h3>
            <p>{member.role}</p>
            <span className="pill team-pill">{member.stream}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
