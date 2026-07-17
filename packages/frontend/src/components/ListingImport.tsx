import { useState } from "react";

interface Props {
  onImport: (text: string, source: { type: "paste" | "fixture"; name?: string }) => void;
}

const FIXTURES = [
  { name: "senior-frontend-engineer.txt", label: "Senior Frontend Engineer" },
  { name: "fullstack-developer.txt", label: "Fullstack Developer" },
];

export function ListingImport({ onImport }: Props) {
  const [text, setText] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onImport(text, { type: "paste" });
    setText("");
  }

  function handleFixtureLoad(name: string) {
    fetch(`/fixtures/listings/${name}`)
      .then((res) => res.text())
      .then((content) => {
        onImport(content, { type: "fixture", name });
      })
      .catch((err) => {
        console.error("Failed to load fixture:", err);
      });
  }

  return (
    <section className="listing-import">
      <h2>Import Job Listing</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="listing-text">Paste job listing text:</label>
        <textarea
          id="listing-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the job listing here..."
          rows={10}
        />
        <button type="submit" disabled={!text.trim()}>
          Import & Assess
        </button>
      </form>

      <div className="fixture-loader">
        <p>Or load a sample fixture:</p>
        <div className="fixture-buttons">
          {FIXTURES.map((fixture) => (
            <button
              key={fixture.name}
              type="button"
              onClick={() => handleFixtureLoad(fixture.name)}
              className="fixture-btn"
            >
              {fixture.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
