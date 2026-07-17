/**
 * Deterministic job-listing normalization.
 *
 * Transforms raw job-listing text into a structured NormalizedListing by
 * extracting clearly labeled sections and detecting known skills from a
 * controlled vocabulary.
 *
 * Limitations of deterministic free-text extraction:
 *
 * - Section headers must follow common patterns (e.g., "Requirements:",
 *   "What you'll do"). Non-standard headings will not be detected.
 * - Skill detection relies on a fixed vocabulary. Niche, emerging, or
 *   domain-specific technologies will be missed.
 * - Title, company, location, and compensation are extracted only when they
 *   appear in recognizable structural positions or formats.
 * - The extractor cannot interpret semantics, infer unstated requirements,
 *   or resolve ambiguity. It preserves uncertainty via confidence levels.
 * - Freeform listings without clear structure will produce many null/empty
 *   fields with low confidence scores.
 */

import type { NormalizedListing } from "./schemas";

// ---------------------------------------------------------------------------
// Controlled skill vocabulary
// ---------------------------------------------------------------------------

const SKILL_VOCABULARY: Record<string, string[]> = {
  Frontend: [
    "React",
    "Vue",
    "Angular",
    "Svelte",
    "Next.js",
    "Nuxt",
    "Remix",
    "Gatsby",
    "Astro",
    "SolidJS",
    "Preact",
    "Lit",
  ],
  Languages: [
    "TypeScript",
    "JavaScript",
    "Python",
    "Rust",
    "Go",
    "Java",
    "C#",
    "C++",
    "Ruby",
    "PHP",
    "Swift",
    "Kotlin",
    "Dart",
    "Scala",
    "Elixir",
    "Haskell",
    "Clojure",
    "Lua",
    "Zig",
  ],
  Backend: [
    "Node.js",
    "Express",
    "Fastify",
    "Django",
    "Flask",
    "FastAPI",
    "Spring Boot",
    "Rails",
    "Laravel",
    "Phoenix",
    "Actix",
    "Axum",
    "NestJS",
    "Hono",
    "Elysia",
  ],
  Database: [
    "PostgreSQL",
    "MySQL",
    "MongoDB",
    "Redis",
    "SQLite",
    "DynamoDB",
    "Cassandra",
    "Elasticsearch",
    "Supabase",
    "PlanetScale",
    "Neon",
    "Turso",
    "CockroachDB",
  ],
  DevOps: [
    "Docker",
    "Kubernetes",
    "AWS",
    "GCP",
    "Azure",
    "Terraform",
    "Ansible",
    "Jenkins",
    "GitHub Actions",
    "GitLab CI",
    "CircleCI",
    "Vercel",
    "Cloudflare",
    "Fly.io",
  ],
  Testing: [
    "Jest",
    "Vitest",
    "Mocha",
    "Cypress",
    "Playwright",
    "Puppeteer",
    "Testing Library",
    "Storybook",
    "Chromatic",
  ],
  "CSS & Styling": [
    "Tailwind",
    "Sass",
    "SCSS",
    "CSS Modules",
    "Styled Components",
    "Emotion",
    "CSS-in-JS",
    "PostCSS",
    "Radix UI",
    "Headless UI",
    "shadcn/ui",
  ],
  "Tools & Practices": [
    "Git",
    "GraphQL",
    "REST",
    "gRPC",
    "WebSocket",
    "OAuth",
    "Webpack",
    "Vite",
    "esbuild",
    "Turborepo",
    "Nx",
    "Bun",
    "Deno",
    "Agile",
    "Scrum",
    "CI/CD",
    "TDD",
    "DDD",
    "Microservices",
    "Monorepo",
    "Figma",
  ],
  "Soft Skills": [
    "Leadership",
    "Mentoring",
    "Communication",
    "Collaboration",
    "Problem-solving",
    "Project management",
  ],
};

// Build a flat set of all known skill names (lowercased for matching).
const ALL_SKILLS: Map<string, string> = new Map();
for (const [, skills] of Object.entries(SKILL_VOCABULARY)) {
  for (const skill of skills) {
    ALL_SKILLS.set(skill.toLowerCase(), skill);
  }
}

// ---------------------------------------------------------------------------
// Section header patterns
// ---------------------------------------------------------------------------

interface SectionPattern {
  name: string;
  pattern: RegExp;
}

const SECTION_PATTERNS: SectionPattern[] = [
  {
    name: "requirements",
    pattern:
      /^(?:requirements|qualifications|what you'?ll need|you should have|must haves?|required skills?|what we'?re looking for)\s*:?\s*$/i,
  },
  {
    name: "responsibilities",
    pattern:
      /^(?:responsibilities|what you'?ll do|your role|day.to.day|what you will do|key responsibilities|duties)\s*:?\s*$/i,
  },
  { name: "about", pattern: /^(?:about(?:\s+(?:us|the company|the team))?)\s*:?\s*$/i },
  {
    name: "benefits",
    pattern: /^(?:benefits|perks|what we offer|compensation(?:\s*&\s*benefits)?|salary)\s*:?\s*$/i,
  },
  {
    name: "description",
    pattern:
      /^(?:(?:the\s+)?role|job description|about the role|position overview|summary)\s*:?\s*$/i,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectSkills(text: string): string[] {
  const found = new Set<string>();
  const lowerText = text.toLowerCase();

  for (const [lowerName, canonicalName] of ALL_SKILLS) {
    // Multi-word skills: simple substring match
    if (lowerName.includes(" ")) {
      if (lowerText.includes(lowerName)) {
        found.add(canonicalName);
      }
      continue;
    }
    // Single-word skills: word boundary check, with special-case for C#/C++
    const escaped = lowerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const boundaryRegex = new RegExp(`\\b${escaped}\\b`, "i");
    if (boundaryRegex.test(text)) {
      found.add(canonicalName);
    }
  }

  return [...found].sort();
}

function splitIntoSections(lines: string[]): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let currentSection = "header";
  sections.set(currentSection, []);

  for (const line of lines) {
    const trimmed = line.trim();
    let matchedSection: string | null = null;

    for (const { name, pattern } of SECTION_PATTERNS) {
      if (pattern.test(trimmed)) {
        matchedSection = name;
        break;
      }
    }

    if (matchedSection) {
      currentSection = matchedSection;
      if (!sections.has(currentSection)) {
        sections.set(currentSection, []);
      }
    } else {
      const items = sections.get(currentSection);
      if (items && trimmed.length > 0) {
        items.push(trimmed);
      }
    }
  }

  return sections;
}

function extractBulletItems(lines: string[]): string[] {
  return lines
    .map((l) =>
      l
        .replace(/^[\s]*[-•*–—]\s*/, "")
        .replace(/^[\s]*\d+[.)]\s*/, "")
        .trim(),
    )
    .filter((l) => l.length > 0);
}

function extractExperience(text: string): NormalizedListing["experience"] {
  // "X+ years" or "X-Y years"
  const rangeMatch = text.match(/(\d+)\s*[-–]\s*(\d+)\s*(?:\+?\s*)years?/i);
  if (rangeMatch) {
    return {
      minYears: parseInt(rangeMatch[1], 10),
      maxYears: parseInt(rangeMatch[2], 10),
      level: inferLevelFromYears(parseInt(rangeMatch[1], 10)),
    };
  }

  const plusMatch = text.match(/(\d+)\s*\+\s*years?/i);
  if (plusMatch) {
    const years = parseInt(plusMatch[1], 10);
    return { minYears: years, maxYears: null, level: inferLevelFromYears(years) };
  }

  const simpleMatch = text.match(/(\d+)\s+years?/i);
  if (simpleMatch) {
    const years = parseInt(simpleMatch[1], 10);
    return { minYears: years, maxYears: null, level: inferLevelFromYears(years) };
  }

  // Detect level from title/keywords
  const lower = text.toLowerCase();
  if (/\b(?:principal|staff)\b/.test(lower))
    return { minYears: null, maxYears: null, level: "principal" };
  if (/\b(?:lead|principal)\b/.test(lower))
    return { minYears: null, maxYears: null, level: "lead" };
  if (/\bsenior\b/.test(lower)) return { minYears: null, maxYears: null, level: "senior" };
  if (/\b(?:mid|intermediate)\b/.test(lower))
    return { minYears: null, maxYears: null, level: "mid" };
  if (/\b(?:junior|entry.level|jr\.?)\b/.test(lower))
    return { minYears: null, maxYears: null, level: "junior" };

  return null;
}

function inferLevelFromYears(years: number): "junior" | "mid" | "senior" | "lead" | "principal" {
  if (years >= 10) return "principal";
  if (years >= 7) return "lead";
  if (years >= 5) return "senior";
  if (years >= 2) return "mid";
  return "junior";
}

function extractCompensation(text: string): NormalizedListing["compensation"] {
  // "$X,000 - $Y,000" or "$Xk - $Yk"
  const fullMatch = text.match(/\$\s*([\d,]+)\s*(?:k)?\s*[-–]\s*\$\s*([\d,]+)\s*(?:k)?/i);
  if (fullMatch) {
    const parseAmount = (s: string, raw: string) => {
      const num = parseInt(s.replace(/,/g, ""), 10);
      return /\bk\b/i.test(raw) ? num * 1000 : num;
    };
    return {
      min: parseAmount(fullMatch[1], fullMatch[0].split("-")[0]),
      max: parseAmount(fullMatch[2], fullMatch[0].split("-")[1] ?? fullMatch[0]),
      currency: "USD",
    };
  }

  const singleMatch = text.match(/\$\s*([\d,]+)/);
  if (singleMatch) {
    const amount = parseInt(singleMatch[1].replace(/,/g, ""), 10);
    return { min: amount, max: null, currency: "USD" };
  }

  return null;
}

function extractLocation(lines: string[]): {
  location: string | null;
  remote: boolean;
} {
  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();

    if (/^(?:remote|fully remote|100% remote|work from (?:home|anywhere))/.test(trimmed)) {
      return { location: "Remote", remote: true };
    }

    if (/^(?:hybrid|flexible)/.test(trimmed)) {
      return { location: line.trim(), remote: false };
    }

    // City, ST or City, Country pattern (first 20 lines only)
    if (/^[A-Z][a-zA-Z\s]+,\s*[A-Z]{2}(?:\s|$)/.test(line.trim())) {
      return { location: line.trim(), remote: false };
    }

    // Labeled location line
    const labeledMatch = line.match(/^(?:location|office|based in|city)\s*:?\s*(.+)/i);
    if (labeledMatch) {
      const value = labeledMatch[1].trim();
      return {
        location: value,
        remote: /remote/i.test(value),
      };
    }
  }

  return { location: null, remote: false };
}

// ---------------------------------------------------------------------------
// Main normalization function
// ---------------------------------------------------------------------------

export function normalizeListing(rawText: string): NormalizedListing {
  const lines = rawText.split(/\r?\n/);
  const sections = splitIntoSections(lines);
  const sectionsExtracted: string[] = [];

  // -- Extract section content -----------------------------------------------

  const requirementsLines = sections.get("requirements") ?? [];
  const responsibilitiesLines = sections.get("responsibilities") ?? [];
  const benefitsLines = sections.get("benefits") ?? [];

  if (sections.has("requirements")) sectionsExtracted.push("requirements");
  if (sections.has("responsibilities")) sectionsExtracted.push("responsibilities");
  if (sections.has("benefits")) sectionsExtracted.push("benefits");
  if (sections.has("about")) sectionsExtracted.push("about");
  if (sections.has("description")) sectionsExtracted.push("description");

  // -- Extract title and company from header ---------------------------------

  const headerLines = sections.get("header") ?? [];
  let title: string | null = null;
  let company: string | null = null;

  // Look for labeled lines first
  for (const line of headerLines) {
    const titleMatch = line.match(/^(?:title|role|position|job title)\s*:?\s*(.+)/i);
    if (titleMatch) title = titleMatch[1].trim();

    const companyMatch = line.match(/^(?:company|employer|organization)\s*:?\s*(.+)/i);
    if (companyMatch) company = companyMatch[1].trim();
  }

  // Fallback: first non-empty header line is title, second is company
  if (!title && headerLines.length > 0) {
    title = headerLines[0];
  }
  if (!company && headerLines.length > 1) {
    company = headerLines[1];
  }

  // -- Location & remote -----------------------------------------------------

  const { location, remote } = extractLocation(lines.slice(0, 20));

  // -- Experience ------------------------------------------------------------

  const experience = extractExperience(rawText);

  // -- Compensation ----------------------------------------------------------

  const compensation = extractCompensation(rawText);

  // -- Skills ----------------------------------------------------------------

  const allSkills = detectSkills(rawText);

  // -- Requirements as bullet items ------------------------------------------

  const requirements = extractBulletItems(requirementsLines);
  const responsibilities = extractBulletItems(responsibilitiesLines);
  const benefits = extractBulletItems(benefitsLines);

  // -- Confidence scoring ----------------------------------------------------

  const confidence: Record<string, "high" | "medium" | "low" | "none"> = {};

  confidence.title = title ? "high" : "none";
  confidence.company = company ? "high" : "none";
  confidence.location = location ? "medium" : "none";
  confidence.skills = allSkills.length > 0 ? "medium" : "low";
  confidence.requirements = requirements.length > 0 ? "high" : "none";
  confidence.responsibilities = responsibilities.length > 0 ? "high" : "none";
  confidence.experience = experience ? "medium" : "low";
  confidence.compensation = compensation ? "high" : "none";

  return {
    title,
    company,
    location,
    remote,
    skills: allSkills,
    requirements,
    responsibilities,
    benefits,
    experience,
    compensation,
    confidence,
    sectionsExtracted,
  };
}
