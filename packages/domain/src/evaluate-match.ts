/**
 * Deterministic match evaluation.
 *
 * Compares a normalized job listing against a career profile and produces
 * an explainable MatchAssessment with categorical verdicts, per-dimension
 * analysis, evidence linkage, and a recommended next action.
 */

import type {
  CareerProfile,
  NormalizedListing,
  MatchAssessment,
  MatchDimension,
  MatchEvidence,
} from "./schemas";

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function evaluateMatch(
  profile: CareerProfile,
  listing: NormalizedListing,
): MatchAssessment {
  const dimensions: MatchDimension[] = [];
  const evidence: MatchEvidence[] = [];
  const strongMatches: string[] = [];
  const partialMatches: string[] = [];
  const missingEvidence: string[] = [];
  const concerns: string[] = [];

  // -- 1. Title match --------------------------------------------------------
  dimensions.push(evaluateTitleMatch(profile, listing, evidence));

  // -- 2. Skill overlap ------------------------------------------------------
  const skillResult = evaluateSkillOverlap(profile, listing, evidence);
  dimensions.push(skillResult.dimension);
  strongMatches.push(...skillResult.strongMatches);
  partialMatches.push(...skillResult.partialMatches);
  missingEvidence.push(...skillResult.missingEvidence);

  // -- 3. Experience match ---------------------------------------------------
  dimensions.push(evaluateExperienceMatch(profile, listing, evidence));

  // -- 4. Location preference ------------------------------------------------
  const locationResult = evaluateLocationPreference(profile, listing);
  dimensions.push(locationResult.dimension);
  if (locationResult.concern) concerns.push(locationResult.concern);

  // -- 5. Compensation alignment ---------------------------------------------
  dimensions.push(evaluateCompensationMatch(profile, listing));

  // -- Compute verdict -------------------------------------------------------
  const { verdict, internalScore } = computeVerdict(dimensions);

  // -- Add missing evidence for entirely absent fields -----------------------
  if (!listing.title) missingEvidence.push("Job title could not be determined");
  if (listing.skills.length === 0)
    missingEvidence.push("No skills detected in listing");

  // -- Recommended action ----------------------------------------------------
  const recommendedAction = computeRecommendedAction(verdict, concerns);

  return {
    verdict,
    dimensions,
    strongMatches,
    partialMatches,
    missingEvidence,
    concerns,
    evidence,
    recommendedAction,
    internalScore,
  };
}

// ---------------------------------------------------------------------------
// Dimension evaluators
// ---------------------------------------------------------------------------

function evaluateTitleMatch(
  profile: CareerProfile,
  listing: NormalizedListing,
  evidence: MatchEvidence[],
): MatchDimension {
  if (!listing.title) {
    return {
      name: "Title alignment",
      score: "none",
      confidence: "none",
      explanation:
        "Cannot evaluate title match — listing title could not be extracted.",
      evidenceIds: [],
    };
  }

  const listingLower = listing.title.toLowerCase();
  const profileTitleLower = profile.title.toLowerCase();

  // Exact substring match
  if (
    listingLower.includes(profileTitleLower) ||
    profileTitleLower.includes(listingLower)
  ) {
    const id = `evidence:title:exact`;
    evidence.push({
      id,
      type: "title",
      label: `Current title "${profile.title}" closely matches listing "${listing.title}"`,
      source: "profile.title",
    });
    return {
      name: "Title alignment",
      score: "strong",
      confidence: "high",
      explanation: `Listing title "${listing.title}" closely matches your title "${profile.title}".`,
      evidenceIds: [id],
    };
  }

  // Check preferred titles
  const preferredTitles = profile.preferences?.titles ?? [];
  for (const preferred of preferredTitles) {
    if (listingLower.includes(preferred.toLowerCase())) {
      const id = `evidence:title:preferred:${preferred}`;
      evidence.push({
        id,
        type: "title",
        label: `Listing title matches preferred title "${preferred}"`,
        source: "profile.preferences.titles",
      });
      return {
        name: "Title alignment",
        score: "strong",
        confidence: "high",
        explanation: `Listing title "${listing.title}" matches your preferred title "${preferred}".`,
        evidenceIds: [id],
      };
    }
  }

  // Keyword overlap
  const profileKeywords = tokenize(profile.title);
  const listingKeywords = tokenize(listing.title);
  const overlap = profileKeywords.filter((k) => listingKeywords.includes(k));

  if (overlap.length > 0) {
    const id = `evidence:title:keyword`;
    evidence.push({
      id,
      type: "title",
      label: `Shared title keywords: ${overlap.join(", ")}`,
      source: "profile.title",
    });
    return {
      name: "Title alignment",
      score: "partial",
      confidence: "medium",
      explanation: `Partial title overlap (${overlap.join(", ")}), but titles are not an exact match.`,
      evidenceIds: [id],
    };
  }

  return {
    name: "Title alignment",
    score: "weak",
    confidence: "medium",
    explanation: `Listing title "${listing.title}" does not align with your title "${profile.title}".`,
    evidenceIds: [],
  };
}

function evaluateSkillOverlap(
  profile: CareerProfile,
  listing: NormalizedListing,
  evidence: MatchEvidence[],
): {
  dimension: MatchDimension;
  strongMatches: string[];
  partialMatches: string[];
  missingEvidence: string[];
} {
  const strongMatches: string[] = [];
  const partialMatches: string[] = [];
  const missingEvidence: string[] = [];

  if (listing.skills.length === 0) {
    missingEvidence.push("No skills detected in listing — cannot evaluate skill overlap");
    return {
      dimension: {
        name: "Skill overlap",
        score: "none",
        confidence: "none",
        explanation:
          "No skills detected in the listing. Skill overlap cannot be assessed.",
        evidenceIds: [],
      },
      strongMatches,
      partialMatches,
      missingEvidence,
    };
  }

  const profileSkillSet = new Set(
    profile.skills.map((s) => s.name.toLowerCase()),
  );
  const listingSkillLower = listing.skills.map((s) => s.toLowerCase());

  const matched: string[] = [];
  const unmatched: string[] = [];

  for (let i = 0; i < listing.skills.length; i++) {
    if (profileSkillSet.has(listingSkillLower[i])) {
      matched.push(listing.skills[i]);
    } else {
      unmatched.push(listing.skills[i]);
    }
  }

  // Build evidence for each matched skill
  const evidenceIds: string[] = [];
  for (const skill of matched) {
    const profileSkill = profile.skills.find(
      (s) => s.name.toLowerCase() === skill.toLowerCase(),
    );
    const id = `evidence:skill:${skill.toLowerCase()}`;
    evidenceIds.push(id);
    evidence.push({
      id,
      type: "skill",
      label: `${skill}${profileSkill?.proficiency ? ` (${profileSkill.proficiency})` : ""}`,
      source: "profile.skills",
    });
    strongMatches.push(skill);
  }

  const ratio = matched.length / listing.skills.length;

  if (ratio >= 0.7 && matched.length >= 3) {
    return {
      dimension: {
        name: "Skill overlap",
        score: "strong",
        confidence: "high",
        explanation: `${matched.length} of ${listing.skills.length} listing skills match your profile (${Math.round(ratio * 100)}%).`,
        evidenceIds,
      },
      strongMatches,
      partialMatches,
      missingEvidence,
    };
  }

  if (ratio >= 0.4 && matched.length >= 1) {
    if (unmatched.length > 0) {
      partialMatches.push(
        `Missing skills: ${unmatched.join(", ")}`,
      );
    }
    return {
      dimension: {
        name: "Skill overlap",
        score: "partial",
        confidence: "medium",
        explanation: `${matched.length} of ${listing.skills.length} listing skills match your profile. Missing: ${unmatched.join(", ")}.`,
        evidenceIds,
      },
      strongMatches,
      partialMatches,
      missingEvidence,
    };
  }

  return {
    dimension: {
      name: "Skill overlap",
      score: "weak",
      confidence: matched.length > 0 ? "medium" : "high",
      explanation:
        matched.length > 0
          ? `Only ${matched.length} of ${listing.skills.length} listing skills match your profile.`
          : "None of the detected listing skills match your profile.",
      evidenceIds,
    },
    strongMatches,
    partialMatches,
    missingEvidence,
  };
}

function evaluateExperienceMatch(
  profile: CareerProfile,
  listing: NormalizedListing,
  evidence: MatchEvidence[],
): MatchDimension {
  const profileYears = profile.experience.totalYears;

  if (!listing.experience) {
    return {
      name: "Experience level",
      score: "none",
      confidence: "none",
      explanation:
        "Listing does not specify experience requirements. Cannot assess alignment.",
      evidenceIds: [],
    };
  }

  const id = `evidence:experience:years`;
  evidence.push({
    id,
    type: "experience",
    label: `${profileYears} years total experience`,
    source: "profile.experience.totalYears",
  });

  const minRequired = listing.experience.minYears;

  if (minRequired !== null && profileYears >= minRequired) {
    return {
      name: "Experience level",
      score: "strong",
      confidence: "high",
      explanation: `Your ${profileYears} years of experience meets the requirement of ${minRequired}+ years.`,
      evidenceIds: [id],
    };
  }

  if (minRequired !== null && profileYears >= minRequired - 1) {
    return {
      name: "Experience level",
      score: "partial",
      confidence: "medium",
      explanation: `Your ${profileYears} years of experience is close to the ${minRequired}+ year requirement.`,
      evidenceIds: [id],
    };
  }

  if (minRequired !== null) {
    return {
      name: "Experience level",
      score: "weak",
      confidence: "high",
      explanation: `Your ${profileYears} years of experience is below the ${minRequired}+ year requirement.`,
      evidenceIds: [id],
    };
  }

  // Only level specified, no year count
  if (listing.experience.level) {
    const levelYears: Record<string, number> = {
      junior: 1,
      mid: 3,
      senior: 5,
      lead: 7,
      principal: 10,
    };
    const expectedMin = levelYears[listing.experience.level] ?? 0;
    if (profileYears >= expectedMin) {
      return {
        name: "Experience level",
        score: "strong",
        confidence: "medium",
        explanation: `Your ${profileYears} years aligns with the "${listing.experience.level}" level.`,
        evidenceIds: [id],
      };
    }
    return {
      name: "Experience level",
      score: "partial",
      confidence: "low",
      explanation: `The listing seeks a "${listing.experience.level}" level role. Your ${profileYears} years may or may not align.`,
      evidenceIds: [id],
    };
  }

  return {
    name: "Experience level",
    score: "none",
    confidence: "none",
    explanation: "Experience requirements could not be fully parsed.",
    evidenceIds: [],
  };
}

function evaluateLocationPreference(
  profile: CareerProfile,
  listing: NormalizedListing,
): { dimension: MatchDimension; concern: string | null } {
  const prefs = profile.preferences;

  if (!prefs?.locations?.length && prefs?.remote === undefined) {
    return {
      dimension: {
        name: "Location & remote",
        score: "none",
        confidence: "none",
        explanation: "No location preferences specified in your profile.",
        evidenceIds: [],
      },
      concern: null,
    };
  }

  // Profile wants remote, listing is remote
  if (prefs?.remote && listing.remote) {
    const id = `evidence:preference:remote`;
    return {
      dimension: {
        name: "Location & remote",
        score: "strong",
        confidence: "high",
        explanation: "Listing offers remote work, matching your preference.",
        evidenceIds: [id],
      },
      concern: null,
    };
  }

  // Profile wants remote, listing is onsite
  if (prefs?.remote && !listing.remote && listing.location) {
    return {
      dimension: {
        name: "Location & remote",
        score: "weak",
        confidence: "high",
        explanation: `Listing is at ${listing.location}, but you prefer remote work.`,
        evidenceIds: [],
      },
      concern: `Location mismatch: listing is at "${listing.location}" but you prefer remote work.`,
    };
  }

  // Check location match
  if (prefs?.locations?.length && listing.location) {
    const preferredLower = prefs.locations.map((l) => l.toLowerCase());
    const listingLocLower = listing.location.toLowerCase();

    for (const pref of preferredLower) {
      if (listingLocLower.includes(pref)) {
        const id = `evidence:preference:location:${pref}`;
        return {
          dimension: {
            name: "Location & remote",
            score: "strong",
            confidence: "high",
            explanation: `Listing location "${listing.location}" matches your preferred location "${pref}".`,
            evidenceIds: [id],
          },
          concern: null,
        };
      }
    }

    return {
      dimension: {
        name: "Location & remote",
        score: "partial",
        confidence: "medium",
        explanation: `Listing location "${listing.location}" may not match your preferred locations (${prefs.locations.join(", ")}).`,
        evidenceIds: [],
      },
      concern: null,
    };
  }

  return {
    dimension: {
      name: "Location & remote",
      score: "partial",
      confidence: "low",
      explanation: "Insufficient information to fully assess location alignment.",
      evidenceIds: [],
    },
    concern: null,
  };
}

function evaluateCompensationMatch(
  profile: CareerProfile,
  listing: NormalizedListing,
): MatchDimension {
  const prefComp = profile.preferences?.compensation;

  if (!prefComp?.min && !prefComp?.max) {
    return {
      name: "Compensation",
      score: "none",
      confidence: "none",
      explanation: "No compensation preferences specified in your profile.",
      evidenceIds: [],
    };
  }

  if (!listing.compensation) {
    return {
      name: "Compensation",
      score: "none",
      confidence: "none",
      explanation: "Listing does not specify compensation. Cannot assess alignment.",
      evidenceIds: [],
    };
  }

  const prefMin = prefComp.min ?? 0;
  const listingMax = listing.compensation.max ?? listing.compensation.min ?? 0;

  if (listingMax >= prefMin) {
    return {
      name: "Compensation",
      score: "strong",
      confidence: "medium",
      explanation: `Listing compensation ($${listingMax.toLocaleString()}) meets your minimum ($${prefMin.toLocaleString()}).`,
      evidenceIds: [],
    };
  }

  return {
    name: "Compensation",
    score: "weak",
    confidence: "medium",
    explanation: `Listing compensation ($${listingMax.toLocaleString()}) is below your minimum preference ($${prefMin.toLocaleString()}).`,
    evidenceIds: [],
  };
}

// ---------------------------------------------------------------------------
// Verdict computation
// ---------------------------------------------------------------------------

function computeVerdict(dimensions: MatchDimension[]): {
  verdict: MatchAssessment["verdict"];
  internalScore: number;
} {
  const scoreValues: Record<string, number> = {
    strong: 1.0,
    partial: 0.5,
    weak: 0.1,
    none: 0,
  };
  const confidenceWeights: Record<string, number> = {
    high: 1.0,
    medium: 0.7,
    low: 0.3,
    none: 0,
  };

  let totalWeight = 0;
  let weightedSum = 0;

  for (const dim of dimensions) {
    const weight = confidenceWeights[dim.confidence] ?? 0;
    totalWeight += weight;
    weightedSum += (scoreValues[dim.score] ?? 0) * weight;
  }

  const internalScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Count informative dimensions (confidence > none)
  const informativeDimensions = dimensions.filter((d) => d.confidence !== "none");

  // If most dimensions have no confidence, insufficient evidence
  if (informativeDimensions.length <= 1) {
    return { verdict: "insufficient-evidence", internalScore };
  }

  const strongCount = dimensions.filter(
    (d) => d.score === "strong" && d.confidence !== "none",
  ).length;
  const partialCount = dimensions.filter(
    (d) => d.score === "partial" && d.confidence !== "none",
  ).length;
  const weakCount = dimensions.filter(
    (d) => d.score === "weak" && d.confidence !== "none",
  ).length;

  if (strongCount >= 3 && weakCount === 0) {
    return { verdict: "strong", internalScore };
  }
  if (strongCount >= 2 && weakCount <= 1) {
    return { verdict: "promising", internalScore };
  }
  if (strongCount + partialCount >= 2 && weakCount <= 1) {
    return { verdict: "mixed", internalScore };
  }

  return { verdict: "weak", internalScore };
}

function computeRecommendedAction(
  verdict: MatchAssessment["verdict"],
  concerns: string[],
): string {
  if (concerns.length > 0) {
    return `Review concerns before proceeding. Consider whether ${concerns[0].toLowerCase()}`;
  }

  switch (verdict) {
    case "strong":
      return "Strong alignment — consider applying and tailoring your application.";
    case "promising":
      return "Promising match — review details and consider applying.";
    case "mixed":
      return "Mixed signals — review the assessment details before deciding.";
    case "weak":
      return "Weak alignment — consider skipping unless you have additional relevant experience not captured in your profile.";
    case "insufficient-evidence":
      return "Insufficient evidence — the listing or profile may need more detail for a reliable assessment.";
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}
