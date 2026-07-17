import { describe, expect, it } from "vitest";
import {
  CareerProfileSchema,
  ListingStatusSchema,
  MatchAssessmentSchema,
  NormalizedListingSchema,
  RawJobListingSchema,
} from "../src/schemas";

describe("CareerProfileSchema", () => {
  it("accepts a valid career profile", () => {
    const profile = {
      id: "profile-1",
      name: "Jane Developer",
      title: "Senior Frontend Engineer",
      summary: "Experienced frontend engineer specializing in React and TypeScript.",
      skills: [
        { name: "React", category: "Frontend", proficiency: "expert" },
        { name: "TypeScript", category: "Languages", proficiency: "expert" },
      ],
      experience: {
        totalYears: 8,
        roles: [
          { title: "Senior Frontend Engineer", company: "TechCorp", years: 4 },
          { title: "Frontend Developer", company: "StartupXYZ", years: 3 },
          { title: "Junior Developer", company: "Agency Inc", years: 1 },
        ],
      },
      education: [{ degree: "BS Computer Science", institution: "State University", year: 2015 }],
      preferences: {
        locations: ["San Francisco", "Remote"],
        remote: true,
        compensation: { min: 160000, max: 220000, currency: "USD" },
        titles: ["Senior Frontend Engineer", "Staff Engineer"],
      },
    };

    const result = CareerProfileSchema.safeParse(profile);
    expect(result.success).toBe(true);
  });

  it("rejects a profile without required fields", () => {
    const invalid = {
      name: "Jane",
      // missing id, title, skills, experience
    };

    const result = CareerProfileSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects negative totalYears", () => {
    const profile = {
      id: "profile-1",
      name: "Jane",
      title: "Engineer",
      skills: [],
      experience: {
        totalYears: -1,
        roles: [],
      },
    };

    const result = CareerProfileSchema.safeParse(profile);
    expect(result.success).toBe(false);
  });

  it("accepts minimal profile without optional fields", () => {
    const minimal = {
      id: "profile-1",
      name: "Jane Developer",
      title: "Frontend Engineer",
      skills: [{ name: "JavaScript" }],
      experience: {
        totalYears: 3,
        roles: [{ title: "Developer", company: "Corp", years: 3 }],
      },
    };

    const result = CareerProfileSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });
});

describe("RawJobListingSchema", () => {
  it("accepts valid raw listing", () => {
    const listing = {
      text: "Senior Frontend Engineer\nTechCorp\n\nRequirements:\n- React\n- TypeScript",
      source: { type: "paste" as const },
    };

    const result = RawJobListingSchema.safeParse(listing);
    expect(result.success).toBe(true);
  });

  it("accepts fixture source type", () => {
    const listing = {
      text: "Some job listing",
      source: { type: "fixture" as const, name: "senior-frontend-engineer" },
    };

    const result = RawJobListingSchema.safeParse(listing);
    expect(result.success).toBe(true);
  });

  it("rejects empty text", () => {
    const listing = {
      text: "",
      source: { type: "paste" as const },
    };

    const result = RawJobListingSchema.safeParse(listing);
    expect(result.success).toBe(false);
  });

  it("rejects invalid source type", () => {
    const listing = {
      text: "Some text",
      source: { type: "invalid" },
    };

    const result = RawJobListingSchema.safeParse(listing);
    expect(result.success).toBe(false);
  });
});

describe("NormalizedListingSchema", () => {
  it("accepts a fully populated normalized listing", () => {
    const normalized = {
      title: "Senior Frontend Engineer",
      company: "TechCorp",
      location: "San Francisco, CA",
      remote: false,
      skills: ["React", "TypeScript", "GraphQL"],
      requirements: ["5+ years React", "TypeScript experience"],
      responsibilities: ["Build UI components", "Code review"],
      benefits: ["Health insurance", "401k"],
      experience: { minYears: 5, maxYears: null, level: "senior" as const },
      compensation: { min: 160000, max: 220000, currency: "USD" },
      confidence: {
        title: "high" as const,
        company: "high" as const,
        location: "medium" as const,
        skills: "medium" as const,
        requirements: "high" as const,
        responsibilities: "high" as const,
        experience: "medium" as const,
        compensation: "high" as const,
      },
      sectionsExtracted: ["requirements", "responsibilities", "benefits"],
    };

    const result = NormalizedListingSchema.safeParse(normalized);
    expect(result.success).toBe(true);
  });

  it("accepts a minimal normalized listing with nulls", () => {
    const minimal = {
      title: null,
      company: null,
      location: null,
      remote: false,
      skills: [],
      requirements: [],
      responsibilities: [],
      benefits: [],
      experience: null,
      compensation: null,
      confidence: {
        title: "none" as const,
        company: "none" as const,
        location: "none" as const,
        skills: "low" as const,
        requirements: "none" as const,
        responsibilities: "none" as const,
        experience: "low" as const,
        compensation: "none" as const,
      },
      sectionsExtracted: [],
    };

    const result = NormalizedListingSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });
});

describe("MatchAssessmentSchema", () => {
  it("accepts a valid assessment", () => {
    const assessment = {
      verdict: "promising" as const,
      dimensions: [
        {
          name: "Title alignment",
          score: "strong" as const,
          confidence: "high" as const,
          explanation: "Title matches perfectly",
          evidenceIds: ["ev-1"],
        },
      ],
      strongMatches: ["React", "TypeScript"],
      partialMatches: ["GraphQL"],
      missingEvidence: ["No salary info"],
      concerns: [],
      evidence: [
        {
          id: "ev-1",
          type: "skill" as const,
          label: "React",
          source: "profile.skills",
        },
      ],
      recommendedAction: "Consider applying",
      internalScore: 0.85,
    };

    const result = MatchAssessmentSchema.safeParse(assessment);
    expect(result.success).toBe(true);
  });

  it("accepts all verdict types", () => {
    const verdicts = ["strong", "promising", "mixed", "weak", "insufficient-evidence"];

    for (const verdict of verdicts) {
      const assessment = {
        verdict,
        dimensions: [],
        strongMatches: [],
        partialMatches: [],
        missingEvidence: [],
        concerns: [],
        evidence: [],
        recommendedAction: "Review",
      };

      const result = MatchAssessmentSchema.safeParse(assessment);
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid verdict", () => {
    const assessment = {
      verdict: "invalid",
      dimensions: [],
      strongMatches: [],
      partialMatches: [],
      missingEvidence: [],
      concerns: [],
      evidence: [],
      recommendedAction: "Review",
    };

    const result = MatchAssessmentSchema.safeParse(assessment);
    expect(result.success).toBe(false);
  });
});

describe("ListingStatusSchema", () => {
  it("accepts valid statuses", () => {
    const statuses = ["new", "saved", "dismissed", "flagged"];

    for (const status of statuses) {
      const result = ListingStatusSchema.safeParse(status);
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = ListingStatusSchema.safeParse("invalid");
    expect(result.success).toBe(false);
  });
});
