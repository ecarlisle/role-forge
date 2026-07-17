import { describe, it, expect } from "vitest";
import { evaluateMatch } from "../src/evaluate-match";
import type { CareerProfile, NormalizedListing } from "../src/schemas";

function createProfile(overrides: Partial<CareerProfile> = {}): CareerProfile {
  return {
    id: "profile-1",
    name: "Jane Developer",
    title: "Senior Frontend Engineer",
    skills: [
      { name: "React", category: "Frontend", proficiency: "expert" },
      { name: "TypeScript", category: "Languages", proficiency: "expert" },
      { name: "GraphQL", category: "Backend", proficiency: "intermediate" },
    ],
    experience: {
      totalYears: 8,
      roles: [
        { title: "Senior Frontend Engineer", company: "TechCorp", years: 4 },
        { title: "Frontend Developer", company: "StartupXYZ", years: 4 },
      ],
    },
    preferences: {
      locations: ["San Francisco", "Remote"],
      remote: true,
      compensation: { min: 160000, max: 220000, currency: "USD" },
      titles: ["Senior Frontend Engineer", "Staff Engineer"],
    },
    ...overrides,
  };
}

function createListing(overrides: Partial<NormalizedListing> = {}): NormalizedListing {
  return {
    title: "Senior Frontend Engineer",
    company: "TechCorp",
    location: "San Francisco, CA",
    remote: false,
    skills: ["React", "TypeScript", "GraphQL"],
    requirements: ["5+ years React", "TypeScript", "GraphQL"],
    responsibilities: ["Build UI", "Code review"],
    benefits: ["Health insurance"],
    experience: { minYears: 5, maxYears: null, level: "senior" },
    compensation: { min: 160000, max: 220000, currency: "USD" },
    confidence: {
      title: "high",
      company: "high",
      location: "medium",
      skills: "medium",
      requirements: "high",
      responsibilities: "high",
      experience: "medium",
      compensation: "high",
    },
    sectionsExtracted: ["requirements", "responsibilities", "benefits"],
    ...overrides,
  };
}

describe("evaluateMatch", () => {
  it("returns strong verdict for perfect match", () => {
    const profile = createProfile();
    const listing = createListing({
      location: "Remote",
      remote: true,
    });

    const result = evaluateMatch(profile, listing);

    expect(result.verdict).toBe("strong");
    expect(result.dimensions.length).toBeGreaterThan(0);
    expect(result.strongMatches.length).toBeGreaterThan(0);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("returns promising verdict for good match with minor gaps", () => {
    const profile = createProfile();
    const listing = createListing({
      skills: ["React", "TypeScript", "Vue"], // Vue is not in profile
    });

    const result = evaluateMatch(profile, listing);

    expect(["promising", "strong"]).toContain(result.verdict);
    expect(result.partialMatches.length).toBeGreaterThan(0);
  });

  it("returns mixed verdict for partial match", () => {
    const profile = createProfile();
    const listing = createListing({
      skills: ["React", "Vue", "Angular"], // Only React matches
      experience: { minYears: 10, maxYears: null, level: "lead" }, // Higher than profile
    });

    const result = evaluateMatch(profile, listing);

    expect(["mixed", "weak", "promising"]).toContain(result.verdict);
  });

  it("returns weak verdict for poor match", () => {
    const profile = createProfile();
    const listing = createListing({
      title: "Backend Engineer",
      skills: ["Python", "Django", "PostgreSQL"], // No overlap
      experience: { minYears: 10, maxYears: null, level: "lead" },
      compensation: { min: 80000, max: 100000, currency: "USD" }, // Below preference
    });

    const result = evaluateMatch(profile, listing);

    expect(["weak", "mixed"]).toContain(result.verdict);
  });

  it("returns insufficient-evidence verdict for empty listing", () => {
    const profile = createProfile();
    const listing = createListing({
      title: null,
      company: null,
      skills: [],
      requirements: [],
      responsibilities: [],
      benefits: [],
      experience: null,
      compensation: null,
      confidence: {
        title: "none",
        company: "none",
        location: "none",
        skills: "low",
        requirements: "none",
        responsibilities: "none",
        experience: "low",
        compensation: "none",
      },
      sectionsExtracted: [],
    });

    const result = evaluateMatch(profile, listing);

    expect(result.verdict).toBe("insufficient-evidence");
  });

  it("includes title dimension in assessment", () => {
    const profile = createProfile();
    const listing = createListing();

    const result = evaluateMatch(profile, listing);

    const titleDimension = result.dimensions.find((d) => d.name === "Title alignment");
    expect(titleDimension).toBeDefined();
    expect(titleDimension?.explanation).toBeDefined();
  });

  it("includes skills dimension in assessment", () => {
    const profile = createProfile();
    const listing = createListing();

    const result = evaluateMatch(profile, listing);

    const skillsDimension = result.dimensions.find((d) => d.name === "Skill overlap");
    expect(skillsDimension).toBeDefined();
    expect(skillsDimension?.score).toBe("strong");
  });

  it("includes experience dimension in assessment", () => {
    const profile = createProfile();
    const listing = createListing();

    const result = evaluateMatch(profile, listing);

    const expDimension = result.dimensions.find((d) => d.name === "Experience level");
    expect(expDimension).toBeDefined();
  });

  it("includes location dimension in assessment", () => {
    const profile = createProfile();
    const listing = createListing();

    const result = evaluateMatch(profile, listing);

    const locationDimension = result.dimensions.find(
      (d) => d.name === "Location & remote",
    );
    expect(locationDimension).toBeDefined();
  });

  it("includes compensation dimension in assessment", () => {
    const profile = createProfile();
    const listing = createListing();

    const result = evaluateMatch(profile, listing);

    const compDimension = result.dimensions.find((d) => d.name === "Compensation");
    expect(compDimension).toBeDefined();
  });

  it("links evidence to dimensions", () => {
    const profile = createProfile();
    const listing = createListing();

    const result = evaluateMatch(profile, listing);

    expect(result.evidence.length).toBeGreaterThan(0);

    // Check that evidence IDs are referenced in dimensions
    const allEvidenceIds = result.dimensions.flatMap((d) => d.evidenceIds);
    const evidenceIds = result.evidence.map((e) => e.id);

    for (const id of allEvidenceIds) {
      expect(evidenceIds).toContain(id);
    }
  });

  it("provides recommended action", () => {
    const profile = createProfile();
    const listing = createListing();

    const result = evaluateMatch(profile, listing);

    expect(result.recommendedAction).toBeDefined();
    expect(result.recommendedAction.length).toBeGreaterThan(0);
  });

  it("includes internal score when available", () => {
    const profile = createProfile();
    const listing = createListing();

    const result = evaluateMatch(profile, listing);

    expect(result.internalScore).toBeDefined();
    expect(result.internalScore).toBeGreaterThanOrEqual(0);
    expect(result.internalScore).toBeLessThanOrEqual(1);
  });

  it("handles missing title gracefully", () => {
    const profile = createProfile();
    const listing = createListing({ title: null, confidence: { ...createListing().confidence, title: "none" } });

    const result = evaluateMatch(profile, listing);

    const titleDimension = result.dimensions.find((d) => d.name === "Title alignment");
    expect(titleDimension?.score).toBe("none");
    expect(titleDimension?.confidence).toBe("none");
  });

  it("handles missing skills gracefully", () => {
    const profile = createProfile();
    const listing = createListing({
      skills: [],
      confidence: { ...createListing().confidence, skills: "low" },
    });

    const result = evaluateMatch(profile, listing);

    const skillsDimension = result.dimensions.find((d) => d.name === "Skill overlap");
    expect(skillsDimension?.score).toBe("none");
    expect(skillsDimension?.confidence).toBe("none");
  });

  it("flags location concerns when remote preference conflicts", () => {
    const profile = createProfile({
      preferences: {
        ...createProfile().preferences,
        remote: true,
      },
    });
    const listing = createListing({
      location: "New York, NY",
      remote: false,
    });

    const result = evaluateMatch(profile, listing);

    expect(result.concerns.length).toBeGreaterThan(0);
    expect(result.concerns.some((c) => c.toLowerCase().includes("remote"))).toBe(true);
  });
});
