import type { CareerProfile } from "../api";

interface Props {
  profile: CareerProfile;
}

export function CareerProfileCard({ profile }: Props) {
  return (
    <section className="career-profile">
      <h2>{profile.name}</h2>
      <p className="profile-title">{profile.title}</p>
      {profile.summary && <p className="profile-summary">{profile.summary}</p>}

      <div className="profile-section">
        <h3>Skills</h3>
        <ul className="skills-list">
          {profile.skills.map((skill) => (
            <li key={skill.name}>
              <strong>{skill.name}</strong>
              {skill.proficiency && <span> ({skill.proficiency})</span>}
              {skill.category && <span className="skill-category"> - {skill.category}</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="profile-section">
        <h3>Experience</h3>
        <p>{profile.experience.totalYears} years total</p>
        <ul className="roles-list">
          {profile.experience.roles.map((role, i) => (
            <li key={i}>
              <strong>{role.title}</strong> at {role.company} ({role.years} years)
            </li>
          ))}
        </ul>
      </div>

      {profile.education && profile.education.length > 0 && (
        <div className="profile-section">
          <h3>Education</h3>
          <ul>
            {profile.education.map((edu, i) => (
              <li key={i}>
                {edu.degree} - {edu.institution}
                {edu.year && ` (${edu.year})`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {profile.preferences && (
        <div className="profile-section">
          <h3>Preferences</h3>
          {profile.preferences.locations && profile.preferences.locations.length > 0 && (
            <p>
              <strong>Locations:</strong> {profile.preferences.locations.join(", ")}
            </p>
          )}
          {profile.preferences.remote !== undefined && (
            <p>
              <strong>Remote:</strong> {profile.preferences.remote ? "Yes" : "No"}
            </p>
          )}
          {profile.preferences.compensation && (
            <p>
              <strong>Compensation:</strong>{" "}
              {profile.preferences.compensation.min && `$${profile.preferences.compensation.min.toLocaleString()}`}
              {profile.preferences.compensation.min && profile.preferences.compensation.max && " - "}
              {profile.preferences.compensation.max && `$${profile.preferences.compensation.max.toLocaleString()}`}
              {profile.preferences.compensation.currency && ` ${profile.preferences.compensation.currency}`}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
