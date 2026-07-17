import { describe, expect, it } from "vitest";
import { normalizeListing } from "../src/normalize-listing";

describe("normalizeListing", () => {
  it("extracts title and company from header lines", () => {
    const text = `Senior Frontend Engineer
TechCorp Inc

About us:
We are building the future of work.

Requirements:
- 5+ years React experience
- TypeScript proficiency`;

    const result = normalizeListing(text);

    expect(result.title).toBe("Senior Frontend Engineer");
    expect(result.company).toBe("TechCorp Inc");
    expect(result.confidence.title).toBe("high");
    expect(result.confidence.company).toBe("high");
  });

  it("extracts requirements section", () => {
    const text = `Frontend Developer
Acme Corp

Requirements:
- React experience
- TypeScript
- 3+ years experience`;

    const result = normalizeListing(text);

    expect(result.requirements).toContain("React experience");
    expect(result.requirements).toContain("TypeScript");
    expect(result.requirements).toContain("3+ years experience");
    expect(result.sectionsExtracted).toContain("requirements");
    expect(result.confidence.requirements).toBe("high");
  });

  it("extracts responsibilities section", () => {
    const text = `Engineer
Company

What you'll do:
- Build features
- Review code
- Mentor juniors`;

    const result = normalizeListing(text);

    expect(result.responsibilities).toContain("Build features");
    expect(result.responsibilities).toContain("Review code");
    expect(result.sectionsExtracted).toContain("responsibilities");
  });

  it("detects skills from controlled vocabulary", () => {
    const text = `Frontend Engineer
Startup

Requirements:
- React and TypeScript
- Node.js experience
- PostgreSQL
- Docker
- GraphQL`;

    const result = normalizeListing(text);

    expect(result.skills).toContain("React");
    expect(result.skills).toContain("TypeScript");
    expect(result.skills).toContain("Node.js");
    expect(result.skills).toContain("PostgreSQL");
    expect(result.skills).toContain("Docker");
    expect(result.skills).toContain("GraphQL");
    expect(result.confidence.skills).toBe("medium");
  });

  it("extracts experience requirements", () => {
    const text = `Senior Engineer
Corp

Requirements:
- 5+ years experience`;

    const result = normalizeListing(text);

    expect(result.experience).not.toBeNull();
    expect(result.experience?.minYears).toBe(5);
    expect(result.experience?.level).toBe("senior");
    expect(result.confidence.experience).toBe("medium");
  });

  it("extracts experience range", () => {
    const text = `Engineer
Corp

Requirements:
- 3-5 years experience`;

    const result = normalizeListing(text);

    expect(result.experience?.minYears).toBe(3);
    expect(result.experience?.maxYears).toBe(5);
  });

  it("detects senior level from title", () => {
    const text = `Senior Frontend Engineer
Company`;

    const result = normalizeListing(text);

    expect(result.experience?.level).toBe("senior");
  });

  it("extracts compensation", () => {
    const text = `Engineer
Corp

Benefits:
- $120,000 - $160,000
- Health insurance`;

    const result = normalizeListing(text);

    expect(result.compensation).not.toBeNull();
    expect(result.compensation?.min).toBe(120000);
    expect(result.compensation?.max).toBe(160000);
    expect(result.compensation?.currency).toBe("USD");
    expect(result.confidence.compensation).toBe("high");
  });

  it("extracts remote location", () => {
    const text = `Engineer
Corp
Remote`;

    const result = normalizeListing(text);

    expect(result.location).toBe("Remote");
    expect(result.remote).toBe(true);
  });

  it("extracts city location", () => {
    const text = `Engineer
Corp
San Francisco, CA`;

    const result = normalizeListing(text);

    expect(result.location).toBe("San Francisco, CA");
    expect(result.remote).toBe(false);
  });

  it("extracts benefits section", () => {
    const text = `Engineer
Corp

Benefits:
- Health insurance
- 401k matching
- Unlimited PTO`;

    const result = normalizeListing(text);

    expect(result.benefits).toContain("Health insurance");
    expect(result.benefits).toContain("401k matching");
    expect(result.benefits).toContain("Unlimited PTO");
    expect(result.sectionsExtracted).toContain("benefits");
  });

  it("handles empty text gracefully", () => {
    const result = normalizeListing("");

    expect(result.title).toBeNull();
    expect(result.company).toBeNull();
    expect(result.skills).toEqual([]);
    expect(result.requirements).toEqual([]);
    expect(result.confidence.title).toBe("none");
    expect(result.confidence.company).toBe("none");
  });

  it("handles text with no clear structure", () => {
    const text = `This is just some random text without any clear job listing structure.
It doesn't have any section headers or standard formatting.
Just paragraphs of text.`;

    const result = normalizeListing(text);

    expect(result.title).toBe(
      "This is just some random text without any clear job listing structure.",
    );
    expect(result.company).toBe("It doesn't have any section headers or standard formatting.");
    expect(result.requirements).toEqual([]);
    expect(result.confidence.title).toBe("high");
    expect(result.confidence.company).toBe("high");
  });

  it("preserves original structure in confidence scores", () => {
    const text = `Title
Company

Requirements:
- React
- TypeScript`;

    const result = normalizeListing(text);

    expect(result.confidence.title).toBe("high");
    expect(result.confidence.company).toBe("high");
    expect(result.confidence.requirements).toBe("high");
    expect(result.confidence.location).toBe("none");
    expect(result.confidence.compensation).toBe("none");
  });
});
