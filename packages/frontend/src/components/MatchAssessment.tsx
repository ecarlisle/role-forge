import type { MatchAssessment as MatchAssessmentType } from "../api";

interface Props {
  assessment: MatchAssessmentType;
}

const VERDICT_LABELS: Record<string, string> = {
  strong: "Strong Match",
  promising: "Promising",
  mixed: "Mixed Signals",
  weak: "Weak Match",
  "insufficient-evidence": "Insufficient Evidence",
};

const VERDICT_COLORS: Record<string, string> = {
  strong: "#10b981",
  promising: "#3b82f6",
  mixed: "#f59e0b",
  weak: "#ef4444",
  "insufficient-evidence": "#6b7280",
};

export function MatchAssessment({ assessment }: Props) {
  const {
    verdict,
    dimensions,
    strongMatches,
    partialMatches,
    missingEvidence,
    concerns,
    evidence,
    recommendedAction,
  } = assessment;

  return (
    <section className="match-assessment">
      <h3>Match Assessment</h3>

      <div className="verdict" style={{ borderColor: VERDICT_COLORS[verdict] }}>
        <div className="verdict-label">{VERDICT_LABELS[verdict]}</div>
        {assessment.internalScore !== undefined && (
          <div className="verdict-score">
            Score: {(assessment.internalScore * 100).toFixed(0)}%
          </div>
        )}
      </div>

      <div className="assessment-sections">
        {strongMatches.length > 0 && (
          <div className="section">
            <h4>✓ Strong Matches</h4>
            <ul>
              {strongMatches.map((match, i) => (
                <li key={i}>{match}</li>
              ))}
            </ul>
          </div>
        )}

        {partialMatches.length > 0 && (
          <div className="section">
            <h4>~ Partial Matches</h4>
            <ul>
              {partialMatches.map((match, i) => (
                <li key={i}>{match}</li>
              ))}
            </ul>
          </div>
        )}

        {missingEvidence.length > 0 && (
          <div className="section">
            <h4>? Missing Evidence</h4>
            <ul>
              {missingEvidence.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {concerns.length > 0 && (
          <div className="section concerns">
            <h4>⚠ Concerns</h4>
            <ul>
              {concerns.map((concern, i) => (
                <li key={i}>{concern}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="dimensions">
        <h4>Dimension Breakdown</h4>
        <div className="dimensions-list">
          {dimensions.map((dim, i) => (
            <div key={i} className="dimension">
              <div className="dimension-header">
                <span className="dimension-name">{dim.name}</span>
                <span className={`dimension-score score-${dim.score}`}>
                  {dim.score}
                </span>
                <span className={`dimension-confidence conf-${dim.confidence}`}>
                  ({dim.confidence} confidence)
                </span>
              </div>
              <p className="dimension-explanation">{dim.explanation}</p>
            </div>
          ))}
        </div>
      </div>

      {evidence.length > 0 && (
        <div className="evidence">
          <h4>Supporting Evidence</h4>
          <ul>
            {evidence.map((ev) => (
              <li key={ev.id}>
                <span className="evidence-type">{ev.type}</span>: {ev.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="recommendation">
        <h4>Recommended Action</h4>
        <p>{recommendedAction}</p>
      </div>
    </section>
  );
}
