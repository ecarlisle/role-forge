import type { Listing } from "../api";
import { MatchAssessment } from "./MatchAssessment";

interface Props {
  listing: Listing;
  onStatusUpdate: (id: string, status: "saved" | "dismissed" | "flagged") => void;
}

export function ListingDetail({ listing, onStatusUpdate }: Props) {
  const { normalized, assessment } = listing;

  return (
    <section className="listing-detail">
      <h2>
        {normalized.title || "Untitled Position"}
        {normalized.company && <span className="listing-company"> at {normalized.company}</span>}
      </h2>

      <div className="listing-meta">
        {normalized.location && <span className="meta-item">📍 {normalized.location}</span>}
        {normalized.remote && <span className="meta-item">🌐 Remote</span>}
        {normalized.experience && (
          <span className="meta-item">
            💼 {normalized.experience.minYears}+ years
            {normalized.experience.level && ` (${normalized.experience.level})`}
          </span>
        )}
      </div>

      <div className="listing-columns">
        <div className="column">
          <h3>Original Text</h3>
          <pre className="raw-text">{listing.rawText}</pre>
        </div>

        <div className="column">
          <h3>Normalized Data</h3>
          <div className="normalized-sections">
            {normalized.skills.length > 0 && (
              <div className="section">
                <h4>Skills ({normalized.skills.length})</h4>
                <ul className="skills-tags">
                  {normalized.skills.map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              </div>
            )}

            {normalized.requirements.length > 0 && (
              <div className="section">
                <h4>Requirements</h4>
                <ul>
                  {normalized.requirements.map((req, i) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </div>
            )}

            {normalized.responsibilities.length > 0 && (
              <div className="section">
                <h4>Responsibilities</h4>
                <ul>
                  {normalized.responsibilities.map((resp, i) => (
                    <li key={i}>{resp}</li>
                  ))}
                </ul>
              </div>
            )}

            {normalized.benefits.length > 0 && (
              <div className="section">
                <h4>Benefits</h4>
                <ul>
                  {normalized.benefits.map((benefit, i) => (
                    <li key={i}>{benefit}</li>
                  ))}
                </ul>
              </div>
            )}

            {normalized.compensation && (
              <div className="section">
                <h4>Compensation</h4>
                <p>
                  {normalized.compensation.min && `$${normalized.compensation.min.toLocaleString()}`}
                  {normalized.compensation.min && normalized.compensation.max && " - "}
                  {normalized.compensation.max && `$${normalized.compensation.max.toLocaleString()}`}
                  {normalized.compensation.currency && ` ${normalized.compensation.currency}`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <MatchAssessment assessment={assessment} />

      <div className="status-actions">
        <button
          onClick={() => onStatusUpdate(listing.id, "saved")}
          disabled={listing.status === "saved"}
          className="btn-save"
        >
          {listing.status === "saved" ? "✓ Saved" : "Save"}
        </button>
        <button
          onClick={() => onStatusUpdate(listing.id, "dismissed")}
          disabled={listing.status === "dismissed"}
          className="btn-dismiss"
        >
          {listing.status === "dismissed" ? "✓ Dismissed" : "Dismiss"}
        </button>
        <button
          onClick={() => onStatusUpdate(listing.id, "flagged")}
          disabled={listing.status === "flagged"}
          className="btn-flag"
        >
          {listing.status === "flagged" ? "✓ Flagged" : "Flag for Review"}
        </button>
      </div>
    </section>
  );
}
