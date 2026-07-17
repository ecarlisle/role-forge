# Domain Model

This document defines the core domain entities and their relationships.

## Entities

### CareerProfile

A user's professional profile used as the basis for job matching.

```typescript
{
  id: string;
  name: string;
  title: string;
  summary?: string;
  skills: Skill[];
  experience: {
    totalYears: number;
    roles: Array<{
      title: string;
      company: string;
      years: number;
    }>;
  };
  education?: Array<{
    degree: string;
    institution: string;
    year?: number;
  }>;
  preferences?: {
    locations?: string[];
    remote?: boolean;
    compensation?: {
      min?: number;
      max?: number;
      currency: string;
    };
    titles?: string[];
  };
}
```

### JobListing

A job opportunity, stored in both raw and normalized forms.

```typescript
{
  id: string;
  rawText: string;
  source: ImportSource;
  normalized: NormalizedListing;
  assessment: MatchAssessment;
  status: ListingStatus;
  importedAt: string;
  assessedAt: string;
}
```

### NormalizedListing

Structured representation of a job listing extracted from raw text.

```typescript
{
  title: string | null;
  company: string | null;
  location: string | null;
  remote: boolean;
  skills: string[];
  requirements: string[];
  responsibilities: string[];
  benefits: string[];
  experience: {
    minYears: number | null;
    maxYears: number | null;
    level: "junior" | "mid" | "senior" | "lead" | "principal" | null;
  } | null;
  compensation: {
    min: number | null;
    max: number | null;
    currency: string;
  } | null;
  confidence: Record<string, "high" | "medium" | "low" | "none">;
  sectionsExtracted: string[];
}
```

### MatchAssessment

Deterministic evaluation of how well a job listing matches a career profile.

```typescript
{
  verdict: "strong" | "promising" | "mixed" | "weak" | "insufficient-evidence";
  dimensions: Array<{
    name: string;
    score: "strong" | "partial" | "weak" | "none";
    confidence: "high" | "medium" | "low" | "none";
    explanation: string;
    evidenceIds: string[];
  }>;
  strongMatches: string[];
  partialMatches: string[];
  missingEvidence: string[];
  concerns: string[];
  evidence: Array<{
    id: string;
    type: "skill" | "experience" | "title" | "education" | "preference";
    label: string;
    source: string;
  }>;
  recommendedAction: string;
  internalScore?: number;
}
```

## Match Dimensions

The assessment evaluates five dimensions:

1. **Title alignment** — Does the job title match your current or desired titles?
2. **Skills overlap** — Which required skills do you have?
3. **Experience level** — Does your experience meet the requirement?
4. **Location & remote** — Does the location match your preferences?
5. **Compensation** — Does the salary align with your expectations?

Each dimension has:
- A **score** (strong, partial, weak, none)
- A **confidence** level (high, medium, low, none)
- An **explanation** of the reasoning
- **Evidence IDs** linking to supporting data

## Verdict Logic

The overall verdict is determined by the distribution of dimension scores:

- **strong**: Most dimensions are strong, no weak dimensions
- **promising**: Mix of strong and partial, acceptable gaps
- **mixed**: Significant partial matches with some concerns
- **weak**: Most dimensions are weak or missing
- **insufficient-evidence**: Cannot assess reliably (most dimensions have low/none confidence)

## Status Transitions

Listing status follows a state machine:

```
new → saved | dismissed | flagged
saved → dismissed | flagged
dismissed → saved | flagged
flagged → saved | dismissed
```

Same-status transitions are not allowed.

## Evidence Linking

Each piece of evidence has:
- **id**: Unique identifier (e.g., "ev-skill-react")
- **type**: Category of evidence (skill, experience, title, education, preference)
- **label**: Human-readable description
- **source**: Where the evidence came from in the profile

Dimensions reference evidence by ID, allowing the UI to show which profile data supported each assessment.

## Normalization Confidence

Each extracted field has a confidence level:
- **high**: Clear structure, high certainty
- **medium**: Likely correct but some ambiguity
- **low**: Weak signals, uncertain
- **none**: Not found or not applicable

Confidence levels are used in verdict calculation and help users understand assessment reliability.

---

## Proposed Future Entities (Not Yet Implemented)

The following entities are planned for future milestones to support live job-source retrieval with partial-failure tolerance. They are documented here for architectural planning purposes only.

### SourceAdapter

A source adapter encapsulates retrieval logic for a specific job source (API, career page, etc.).

```typescript
{
  id: string;                          // Unique adapter identifier
  name: string;                        // Human-readable name
  type: "api" | "scraper" | "feed" | "manual";
  capabilities: {
    pagination: boolean;
    filtering: boolean;
    authentication: boolean;
    rateLimiting: boolean;
  };
  health: SourceHealth;
}
```

### RetrievalResult

The outcome of invoking a source adapter. Can represent complete success, partial success, or failure.

```typescript
{
  sourceId: string;
  status: "success" | "partial" | "failure";
  listings: RetrievedListing[];
  warnings: RetrievalWarning[];
  failure?: SourceFailure;
  metadata: {
    pagesRequested: number;
    pagesCompleted: number;
    recordsProcessed: number;
    recordsRejected: number;
    duration: number;               // milliseconds
  };
}
```

### SearchRun

Aggregates multiple source results from a single search operation.

```typescript
{
  id: string;
  query: SearchQuery;
  startedAt: string;                 // ISO timestamp
  completedAt: string | null;
  sourcesRequested: string[];
  sourcesAttempted: string[];
  sourcesCompleted: string[];
  sourcesPartiallyCompleted: string[];
  sourcesFailed: string[];
  results: RetrievalResult[];
  listingsDiscovered: number;
  listingsAccepted: number;
  listingsRejected: number;
  listingsDeduplicated: number;
  coverageComplete: boolean;
  summary: string;                   // Human-readable summary
}
```

### SourceHealth

Tracks the operational status of a source adapter over time.

```typescript
{
  sourceId: string;
  status: "healthy" | "degraded" | "unavailable" | "unsupported";
  lastAttemptedAt: string | null;
  lastSucceededAt: string | null;
  consecutiveFailures: number;
  lastFailureCategory: FailureCategory | null;
  earliestRetryAt: string | null;    // Respect Retry-After
  cachedDataAvailable: boolean;
  userActionRequired: boolean;
  userMessage: string | null;        // Explain what user should do
}
```

### ListingProvenance

Extended metadata for listings retrieved from external sources.

```typescript
{
  listingId: string;
  sourceId: string;
  sourceUrl: string;
  applicationUrl: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastVerifiedAt: string | null;
  verificationState: VerificationState;
  sourceRecordId: string | null;     // Source's internal ID
  normalizationVersion: string;
  originalPayloadRef: string | null; // Reference to raw payload
}
```

### VerificationState

Indicates the freshness and reliability of a listing.

```typescript
type VerificationState =
  | "active-verified"        // Recently confirmed in source
  | "active-stale"           // Not recently verified, but source available
  | "source-unavailable"     // Source temporarily down
  | "removed-from-source"    // No longer found in source
  | "verification-unsupported" // Source doesn't support verification
  | "manually-imported";     // User-provided, no source to verify
```

### SourceFailure

Structured representation of a source failure.

```typescript
{
  category: FailureCategory;
  retryable: boolean;
  message: string;                   // User-friendly explanation
  technicalDetails: string | null;   // For debugging
  retryAfter: string | null;         // ISO timestamp or seconds
}
```

### FailureCategory

A stable taxonomy of failure types.

```typescript
type FailureCategory =
  | "network-error"
  | "timeout"
  | "rate-limited"
  | "authentication-required"
  | "authorization-denied"
  | "invalid-response"
  | "schema-changed"
  | "temporarily-unavailable"
  | "blocked"
  | "unsupported-source"
  | "configuration-error"
  | "unknown";
```

### RetrievalWarning

Non-fatal issues encountered during retrieval.

```typescript
{
  type: "skipped-page" | "malformed-record" | "incomplete-pagination" | "stale-cache";
  message: string;
  affectedRecords: number;
}
```

## Relationships Between Future Entities

- A **SearchRun** contains multiple **RetrievalResults** (one per source)
- Each **RetrievalResult** is produced by a **SourceAdapter**
- Each **SourceAdapter** maintains a **SourceHealth** record
- Each accepted listing gains a **ListingProvenance** record
- **ListingProvenance** references the source and tracks **VerificationState**
- **SourceFailure** and **RetrievalWarning** are embedded in **RetrievalResult**

## Impact on Current Entities

When retrieval is implemented:

- **ImportSource** will be extended to include `sourceId`, `sourceUrl`, and verification metadata
- **JobListing** will gain a `provenance` field linking to **ListingProvenance**
- The UI will need to display verification state and source health
- Match assessments should consider listing freshness (stale listings may warrant caution)

These changes will be backward-compatible with manually imported listings (which will have `verificationState: "manually-imported"`).
