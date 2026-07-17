import { z } from "zod";

// ---------------------------------------------------------------------------
// Career Profile
// ---------------------------------------------------------------------------

export const SkillSchema = z.object({
  name: z.string(),
  category: z.string().optional(),
  proficiency: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
});

export const CareerProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  summary: z.string().optional(),
  skills: z.array(SkillSchema),
  experience: z.object({
    totalYears: z.number().min(0),
    roles: z.array(
      z.object({
        title: z.string(),
        company: z.string(),
        years: z.number().min(0),
      }),
    ),
  }),
  education: z
    .array(
      z.object({
        degree: z.string(),
        institution: z.string(),
        year: z.number().optional(),
      }),
    )
    .optional(),
  preferences: z
    .object({
      locations: z.array(z.string()).optional(),
      remote: z.boolean().optional(),
      compensation: z
        .object({
          min: z.number().optional(),
          max: z.number().optional(),
          currency: z.string().default("USD"),
        })
        .optional(),
      titles: z.array(z.string()).optional(),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Job Listing (raw and normalized)
// ---------------------------------------------------------------------------

export const RawJobListingSchema = z.object({
  text: z.string().min(1),
  source: z.object({
    type: z.enum(["paste", "fixture"]),
    name: z.string().optional(),
  }),
});

export const NormalizedListingSchema = z.object({
  title: z.string().nullable(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  remote: z.boolean(),
  skills: z.array(z.string()),
  requirements: z.array(z.string()),
  responsibilities: z.array(z.string()),
  benefits: z.array(z.string()),
  experience: z
    .object({
      minYears: z.number().nullable(),
      maxYears: z.number().nullable(),
      level: z.enum(["junior", "mid", "senior", "lead", "principal"]).nullable(),
    })
    .nullable(),
  compensation: z
    .object({
      min: z.number().nullable(),
      max: z.number().nullable(),
      currency: z.string().default("USD"),
    })
    .nullable(),
  confidence: z.record(z.string(), z.enum(["high", "medium", "low", "none"])),
  sectionsExtracted: z.array(z.string()),
});

export const ImportSourceSchema = z.object({
  type: z.enum(["paste", "fixture"]),
  name: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Match Assessment
// ---------------------------------------------------------------------------

export const MatchDimensionSchema = z.object({
  name: z.string(),
  score: z.enum(["strong", "partial", "weak", "none"]),
  confidence: z.enum(["high", "medium", "low", "none"]),
  explanation: z.string(),
  evidenceIds: z.array(z.string()),
});

export const MatchEvidenceSchema = z.object({
  id: z.string(),
  type: z.enum(["skill", "experience", "title", "education", "preference"]),
  label: z.string(),
  source: z.string(),
});

export const MatchAssessmentSchema = z.object({
  verdict: z.enum(["strong", "promising", "mixed", "weak", "insufficient-evidence"]),
  dimensions: z.array(MatchDimensionSchema),
  strongMatches: z.array(z.string()),
  partialMatches: z.array(z.string()),
  missingEvidence: z.array(z.string()),
  concerns: z.array(z.string()),
  evidence: z.array(MatchEvidenceSchema),
  recommendedAction: z.string(),
  internalScore: z.number().min(0).max(1).optional(),
});

// ---------------------------------------------------------------------------
// Listing Status
// ---------------------------------------------------------------------------

export const ListingStatusSchema = z.enum(["new", "saved", "dismissed", "flagged"]);

// ---------------------------------------------------------------------------
// Persisted listing (as stored in the database)
// ---------------------------------------------------------------------------

export const PersistedListingSchema = z.object({
  id: z.string(),
  rawText: z.string(),
  source: ImportSourceSchema,
  normalized: NormalizedListingSchema,
  assessment: MatchAssessmentSchema,
  status: ListingStatusSchema,
  importedAt: z.string(),
  assessedAt: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type Skill = z.infer<typeof SkillSchema>;
export type CareerProfile = z.infer<typeof CareerProfileSchema>;
export type RawJobListing = z.infer<typeof RawJobListingSchema>;
export type NormalizedListing = z.infer<typeof NormalizedListingSchema>;
export type ImportSource = z.infer<typeof ImportSourceSchema>;
export type MatchDimension = z.infer<typeof MatchDimensionSchema>;
export type MatchEvidence = z.infer<typeof MatchEvidenceSchema>;
export type MatchAssessment = z.infer<typeof MatchAssessmentSchema>;
export type ListingStatus = z.infer<typeof ListingStatusSchema>;
export type PersistedListing = z.infer<typeof PersistedListingSchema>;
