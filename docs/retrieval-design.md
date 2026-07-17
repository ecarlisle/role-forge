# Retrieval Design: Partial-Failure-Tolerant Job Source Integration

This document defines the contracts, principles, and implementation guidance for Roleforge's future live job-source retrieval system (Milestone 3). It is a design specification, not implementation code.

## Table of Contents

1. [Failure Model](#failure-model)
2. [Source Adapter Contract](#source-adapter-contract)
3. [Retrieval Result Contract](#retrieval-result-contract)
4. [Search Run Lifecycle](#search-run-lifecycle)
5. [Listing Provenance and Verification](#listing-provenance-and-verification)
6. [Retry and Caching Principles](#retry-and-caching-principles)
7. [User Experience Design](#user-experience-design)
8. [Testing Strategy](#testing-strategy)
9. [Implementation Guidance](#implementation-guidance)

---

## Failure Model

### Core Principle

> A source failure should reduce coverage, not corrupt the search or crash the application.

Roleforge treats external job sources as inherently unreliable. Every retrieval operation must be prepared for partial or complete failure at any source.

### Failure Classification

All failures are classified into a stable taxonomy. This classification drives retry decisions and user-facing messages.

```typescript
type FailureCategory =
  | "network-error"              // DNS, connection refused, TLS failure
  | "timeout"                    // Request exceeded timeout threshold
  | "rate-limited"               // HTTP 429 or explicit rate-limit response
  | "authentication-required"    // HTTP 401, missing/expired credentials
  | "authorization-denied"       // HTTP 403, insufficient permissions
  | "invalid-response"           // Malformed JSON, unexpected content type
  | "schema-changed"             // Response structure doesn't match adapter schema
  | "temporarily-unavailable"    // HTTP 503, maintenance mode
  | "blocked"                    // HTTP 403 with bot-detection, IP blocked
  | "unsupported-source"         // Source deprecated, API discontinued
  | "configuration-error"        // Invalid API key, missing required field
  | "unknown";                   // Unclassified error
```

### Retryability

Failures are categorized as retryable or non-retryable:

**Retryable:**
- `network-error` (transient)
- `timeout`
- `rate-limited`
- `temporarily-unavailable`

**Non-Retryable:**
- `authentication-required`
- `authorization-denied`
- `invalid-response`
- `schema-changed`
- `blocked`
- `unsupported-source`
- `configuration-error`

**Context-Dependent:**
- `unknown` (retry once with caution, then escalate)

### Failure Escalation

Track consecutive failures per source:

1. **First failure:** Log, classify, attempt retry if retryable
2. **2-3 consecutive failures:** Mark source as "degraded"
3. **5+ consecutive failures:** Mark source as "unavailable"
4. **Non-retryable failure:** Immediately mark as "unavailable" or "unsupported"

---

## Source Adapter Contract

### Adapter Interface

Every source adapter implements this contract:

```typescript
interface SourceAdapter {
  // Identity
  readonly id: string;
  readonly name: string;
  readonly type: "api" | "scraper" | "feed" | "manual";

  // Capabilities
  readonly capabilities: {
    pagination: boolean;
    filtering: boolean;
    authentication: boolean;
    rateLimiting: boolean;
    conditionalRequests: boolean;  // ETag, Last-Modified
  };

  // Configuration
  readonly config: {
    rateLimitRequestsPerMinute: number;
    timeoutMs: number;
    maxRetries: number;
    backoffBaseMs: number;
    backoffMaxMs: number;
  };

  // Health
  getHealth(): SourceHealth;

  // Retrieval
  retrieve(
    query: SearchQuery,
    options?: RetrievalOptions
  ): Promise<RetrievalResult>;

  // Verification (optional)
  verify?(listingId: string): Promise<VerificationResult>;
}
```

### Adapter Responsibilities

Each adapter must:

1. **Encapsulate source-specific logic**
   - HTTP client configuration
   - Authentication headers
   - Request/response transformation
   - Error parsing

2. **Return structured results**
   - Never throw exceptions for expected failures
   - Always return a `RetrievalResult` (success, partial, or failure)
   - Include warnings for non-fatal issues

3. **Respect rate limits**
   - Track request timestamps
   - Delay requests that would exceed rate limits
   - Honor `Retry-After` headers

4. **Support conditional requests** (when capability is true)
   - Send `If-None-Match` with ETag
   - Send `If-Modified-Since` with Last-Modified
   - Handle 304 Not Modified responses

5. **Classify failures**
   - Parse HTTP status codes
   - Detect timeout errors
   - Identify schema mismatches
   - Return appropriate `FailureCategory`

### Adapter Implementation Example

```typescript
class GitHubJobsAdapter implements SourceAdapter {
  readonly id = "github-jobs";
  readonly name = "GitHub Jobs";
  readonly type = "api";

  readonly capabilities = {
    pagination: true,
    filtering: true,
    authentication: false,
    rateLimiting: true,
    conditionalRequests: false,
  };

  readonly config = {
    rateLimitRequestsPerMinute: 60,
    timeoutMs: 10000,
    maxRetries: 3,
    backoffBaseMs: 1000,
    backoffMaxMs: 30000,
  };

  async retrieve(
    query: SearchQuery,
    options?: RetrievalOptions
  ): Promise<RetrievalResult> {
    const startedAt = Date.now();
    const listings: RetrievedListing[] = [];
    const warnings: RetrievalWarning[] = [];
    let pagesRequested = 0;
    let pagesCompleted = 0;
    let recordsProcessed = 0;
    let recordsRejected = 0;

    try {
      // Build request URL
      const url = this.buildUrl(query);
      pagesRequested = 1;

      // Make request with timeout
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        return {
          sourceId: this.id,
          status: "failure",
          listings: [],
          warnings: [],
          failure: {
            category: "rate-limited",
            retryable: true,
            message: "GitHub Jobs rate limit exceeded",
            technicalDetails: `HTTP 429, Retry-After: ${retryAfter}`,
            retryAfter: retryAfter ? this.parseRetryAfter(retryAfter) : null,
          },
          metadata: {
            pagesRequested,
            pagesCompleted,
            recordsProcessed,
            recordsRejected,
            duration: Date.now() - startedAt,
          },
        };
      }

      // Handle other HTTP errors
      if (!response.ok) {
        return {
          sourceId: this.id,
          status: "failure",
          listings: [],
          warnings: [],
          failure: this.classifyHttpError(response),
          metadata: {
            pagesRequested,
            pagesCompleted,
            recordsProcessed,
            recordsRejected,
            duration: Date.now() - startedAt,
          },
        };
      }

      // Parse response
      const data = await response.json();
      pagesCompleted = 1;

      // Transform listings
      for (const item of data) {
        try {
          const listing = this.transformListing(item);
          listings.push(listing);
          recordsProcessed++;
        } catch (error) {
          recordsRejected++;
          warnings.push({
            type: "malformed-record",
            message: `Failed to parse listing: ${error.message}`,
            affectedRecords: 1,
          });
        }
      }

      // Return success
      return {
        sourceId: this.id,
        status: "success",
        listings,
        warnings,
        metadata: {
          pagesRequested,
          pagesCompleted,
          recordsProcessed,
          recordsRejected,
          duration: Date.now() - startedAt,
        },
      };

    } catch (error) {
      // Handle timeout
      if (error.name === "AbortError") {
        return {
          sourceId: this.id,
          status: "failure",
          listings: [],
          warnings: [],
          failure: {
            category: "timeout",
            retryable: true,
            message: "GitHub Jobs request timed out",
            technicalDetails: `Timeout after ${this.config.timeoutMs}ms`,
            retryAfter: null,
          },
          metadata: {
            pagesRequested,
            pagesCompleted,
            recordsProcessed,
            recordsRejected,
            duration: Date.now() - startedAt,
          },
        };
      }

      // Handle network errors
      return {
        sourceId: this.id,
        status: "failure",
        listings: [],
        warnings: [],
        failure: {
          category: "network-error",
          retryable: true,
          message: "Failed to connect to GitHub Jobs",
          technicalDetails: error.message,
          retryAfter: null,
        },
        metadata: {
          pagesRequested,
          pagesCompleted,
          recordsProcessed,
          recordsRejected,
          duration: Date.now() - startedAt,
        },
      };
    }
  }

  getHealth(): SourceHealth {
    // Implementation tracks health over time
    return {
      sourceId: this.id,
      status: "healthy",
      lastAttemptedAt: null,
      lastSucceededAt: null,
      consecutiveFailures: 0,
      lastFailureCategory: null,
      earliestRetryAt: null,
      cachedDataAvailable: false,
      userActionRequired: false,
      userMessage: null,
    };
  }

  // Helper methods
  private buildUrl(query: SearchQuery): string { /* ... */ }
  private transformListing(item: any): RetrievedListing { /* ... */ }
  private classifyHttpError(response: Response): SourceFailure { /* ... */ }
  private parseRetryAfter(header: string): string { /* ... */ }
}
```

---

## Retrieval Result Contract

### Result Structure

Every adapter invocation returns a `RetrievalResult` that explicitly represents success, partial success, or failure.

```typescript
interface RetrievalResult {
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
    duration: number;
  };
}
```

### Status Semantics

**`success`:**
- All requested pages retrieved
- All records processed successfully
- May include warnings (e.g., deprecated fields)
- `failure` field is undefined

**`partial`:**
- Some pages retrieved, others failed
- Some records processed, others rejected
- `failure` field may describe the partial failure
- `listings` contains successfully retrieved items
- `warnings` describes what was skipped

**`failure`:**
- No listings retrieved (or all rejected)
- `failure` field is required
- `listings` is empty
- `warnings` may provide context

### RetrievedListing

A listing as retrieved from the source, before normalization:

```typescript
interface RetrievedListing {
  sourceRecordId: string;        // Source's unique ID for this listing
  sourceUrl: string;             // URL to view listing on source
  applicationUrl?: string;       // URL to apply (if available)
  retrievedAt: string;           // ISO timestamp
  rawPayload: unknown;           // Original response data
  etag?: string;                 // For conditional requests
  lastModified?: string;         // For conditional requests
}
```

### RetrievalWarning

Non-fatal issues encountered during retrieval:

```typescript
interface RetrievalWarning {
  type:
    | "skipped-page"            // Could not fetch a page
    | "malformed-record"        // Record failed validation
    | "incomplete-pagination"   // Pagination ended prematurely
    | "stale-cache"             // Using cached data
    | "deprecated-field"        // Source field is deprecated
    | "rate-limit-approaching"; // Nearing rate limit
  message: string;
  affectedRecords: number;
}
```

---

## Search Run Lifecycle

### Search Run Structure

A search run aggregates results from multiple sources:

```typescript
interface SearchRun {
  id: string;
  query: SearchQuery;
  startedAt: string;
  completedAt: string | null;

  // Source tracking
  sourcesRequested: string[];
  sourcesAttempted: string[];
  sourcesCompleted: string[];
  sourcesPartiallyCompleted: string[];
  sourcesFailed: string[];

  // Results
  results: RetrievalResult[];
  listingsDiscovered: number;
  listingsAccepted: number;
  listingsRejected: number;
  listingsDeduplicated: number;

  // Coverage
  coverageComplete: boolean;
  summary: string;
}
```

### Lifecycle Phases

#### Phase 1: Initialization

1. Generate unique `SearchRun` ID
2. Record `startedAt` timestamp
3. Identify sources to query based on query and user preferences
4. Set `sourcesRequested` list

#### Phase 2: Independent Execution

1. For each source in `sourcesRequested`:
   - Add to `sourcesAttempted`
   - Check source health (skip if "unavailable" unless user requests retry)
   - Check rate limit (delay if necessary)
   - Invoke `adapter.retrieve(query)`
   - Handle result

2. Execute sources in parallel (with concurrency limit)
3. Each source is independent; one failure doesn't block others

#### Phase 3: Result Aggregation

1. Collect all `RetrievalResult` objects
2. Categorize sources:
   - `status === "success"` → `sourcesCompleted`
   - `status === "partial"` → `sourcesPartiallyCompleted`
   - `status === "failure"` → `sourcesFailed`

3. Count listings:
   - `listingsDiscovered` = sum of all `listings.length`
   - Validate and normalize each listing
   - `listingsRejected` = validation failures
   - `listingsAccepted` = passed validation

#### Phase 4: Deduplication

1. For each accepted listing:
   - Compute canonical ID (e.g., hash of URL or title+company)
   - Check if already seen in this run or in database
   - If duplicate: merge metadata, increment `listingsDeduplicated`
   - If new: add to results

#### Phase 5: Completion

1. Record `completedAt` timestamp
2. Calculate `coverageComplete`:
   - `true` if `sourcesFailed.length === 0`
   - `false` if any source failed
3. Generate `summary` message (see UX section)
4. Persist `SearchRun` and accepted listings

### Coverage Calculation

```typescript
function calculateCoverage(run: SearchRun): {
  complete: boolean;
  percentage: number;
  message: string;
} {
  const total = run.sourcesRequested.length;
  const succeeded = run.sourcesCompleted.length + run.sourcesPartiallyCompleted.length;
  const percentage = (succeeded / total) * 100;

  const complete = run.sourcesFailed.length === 0;

  let message: string;
  if (complete) {
    message = `Search completed successfully across ${total} sources`;
  } else if (succeeded === 0) {
    message = `Search failed: all ${total} sources encountered errors`;
  } else {
    message = `Search partially completed: ${succeeded} of ${total} sources succeeded`;
  }

  return { complete, percentage, message };
}
```

---

## Listing Provenance and Verification

### Provenance Tracking

Every listing retrieved from an external source gains a `ListingProvenance` record:

```typescript
interface ListingProvenance {
  listingId: string;
  sourceId: string;
  sourceUrl: string;
  applicationUrl: string | null;
  firstSeenAt: string;           // First time we saw this listing
  lastSeenAt: string;            // Most recent retrieval
  lastVerifiedAt: string | null; // Last time we confirmed it still exists
  verificationState: VerificationState;
  sourceRecordId: string | null;
  normalizationVersion: string;
  originalPayloadRef: string | null;
}
```

### Verification States

```typescript
type VerificationState =
  | "active-verified"           // Recently confirmed in source
  | "active-stale"              // Not recently verified, but source available
  | "source-unavailable"        // Source temporarily down
  | "removed-from-source"       // No longer found in source
  | "verification-unsupported"  // Source doesn't support verification
  | "manually-imported";        // User-provided, no source to verify
```

### Verification Logic

**Active-Verified:**
- Listing found in source within last 24 hours
- OR source supports conditional requests and returned 304 Not Modified

**Active-Stale:**
- Listing not seen in last 7 days
- Source is healthy and available
- Verification check pending

**Source-Unavailable:**
- Source marked as "degraded" or "unavailable"
- Cannot verify listing status
- Do NOT automatically mark as expired

**Removed-From-Source:**
- Source is healthy
- Explicit verification check did not return this listing
- Marked after 2 consecutive verification failures

**Verification-Unsupported:**
- Source adapter does not implement `verify()` method
- Listing remains "active-stale" indefinitely

**Manually-Imported:**
- Listing imported via paste or fixture
- No source to verify against
- User responsible for freshness

### Verification Workflow

1. **On retrieval:** Set `lastSeenAt`, update `verificationState` to "active-verified"
2. **Periodic check (e.g., daily):**
   - For each "active-verified" listing older than 24 hours:
     - If source supports verification: call `adapter.verify(listingId)`
     - If found: update `lastVerifiedAt`, keep "active-verified"
     - If not found: increment failure counter
     - If 2 consecutive failures: mark as "removed-from-source"
3. **On source failure:**
   - Mark all listings from that source as "source-unavailable"
   - Do NOT mark as "removed-from-source"
4. **On source recovery:**
   - Re-verify listings marked as "source-unavailable"

### Handling Stale Listings

**Do not automatically expire listings based on:**
- Single verification failure
- Source unavailability
- Time elapsed since last seen

**Instead:**
- Display verification state in UI
- Show "last verified" timestamp
- Warn user when listing is stale
- Allow user to manually refresh or dismiss

---

## Retry and Caching Principles

### Retry Policy

Retries are based on failure category and source configuration:

```typescript
interface RetryPolicy {
  maxAttempts: number;           // e.g., 3
  backoffBaseMs: number;         // e.g., 1000
  backoffMaxMs: number;          // e.g., 30000
  jitterFactor: number;          // e.g., 0.2
  respectRetryAfter: boolean;    // true
}

function calculateBackoff(
  attempt: number,
  policy: RetryPolicy,
  retryAfter?: string
): number {
  // Respect Retry-After if present
  if (retryAfter && policy.respectRetryAfter) {
    const retryAfterMs = parseRetryAfter(retryAfter);
    return Math.min(retryAfterMs, policy.backoffMaxMs);
  }

  // Exponential backoff with jitter
  const base = policy.backoffBaseMs * Math.pow(2, attempt - 1);
  const jitter = base * policy.jitterFactor * Math.random();
  const delay = base + jitter;

  return Math.min(delay, policy.backoffMaxMs);
}
```

### Retry Execution

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  policy: RetryPolicy,
  isRetryable: (error: unknown) => boolean
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === policy.maxAttempts || !isRetryable(error)) {
        throw error;
      }

      const delay = calculateBackoff(attempt, policy);
      await sleep(delay);
    }
  }

  throw lastError;
}
```

### Caching Strategy

**Cache successful results:**
- Key: `sourceId + queryHash`
- Value: `RetrievalResult`
- TTL: 1 hour (configurable per source)

**Cache conditional request headers:**
- Store ETag and Last-Modified per source+query
- Send on subsequent requests
- Handle 304 Not Modified

**Fallback to cache:**
- When source fails with retryable error
- Return cached result with `stale-cache` warning
- Mark listings as "source-unavailable"

### Rate Limiting

**Per-source rate limits:**
```typescript
class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private requestsPerMinute: number,
    private windowMs: number = 60000
  ) {}

  async acquire(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Remove old timestamps
    this.timestamps = this.timestamps.filter(t => t > windowStart);

    // Check if at limit
    if (this.timestamps.length >= this.requestsPerMinute) {
      const oldestInWindow = this.timestamps[0];
      const waitTime = oldestInWindow + this.windowMs - now;
      await sleep(waitTime);
      return this.acquire(); // Retry after waiting
    }

    // Record this request
    this.timestamps.push(now);
  }
}
```

**Usage in adapter:**
```typescript
async retrieve(query: SearchQuery): Promise<RetrievalResult> {
  await this.rateLimiter.acquire();
  // ... make request
}
```

---

## User Experience Design

### Coverage Reporting

**Complete coverage (all sources succeeded):**
```
✓ Search completed successfully
  Found 47 listings across 5 sources
```

**Partial coverage (some sources failed):**
```
⚠ Search completed with partial coverage
  Found 32 listings from 3 of 5 sources
  
  Failed sources:
  • LinkedIn Jobs: Rate limit exceeded (retry after 2:30 PM)
  • Indeed: Temporarily unavailable
```

**No results with complete coverage:**
```
✓ Search completed successfully
  No listings found matching your criteria
```

**No results with partial coverage:**
```
⚠ Search incomplete
  No listings found, but 2 of 3 sources failed
  
  Failed sources:
  • GitHub Jobs: Connection timeout
  • Stack Overflow Jobs: Authentication required
```

### Source Health Display

Show source status in settings or sidebar:

```
Job Sources
├── ✓ GitHub Jobs (healthy, last checked 5 min ago)
├── ⚠ LinkedIn Jobs (degraded, 2 failures, retry at 2:30 PM)
├── ✗ Indeed (unavailable, 5 consecutive failures)
└── ? Stack Overflow Jobs (authentication required)
```

### Listing Freshness Indicators

**Active-Verified (green):**
```
Senior Frontend Engineer at Acme Corp
✓ Verified 2 hours ago
```

**Active-Stale (yellow):**
```
Senior Frontend Engineer at Acme Corp
⚠ Last verified 8 days ago
[Refresh] [Dismiss]
```

**Source-Unavailable (gray):**
```
Senior Frontend Engineer at Acme Corp
○ Source temporarily unavailable
Last seen 3 days ago
```

**Removed-From-Source (red):**
```
Senior Frontend Engineer at Acme Corp
✗ No longer available
Removed from source 2 days ago
[Dismiss]
```

**Manually-Imported (blue):**
```
Senior Frontend Engineer at Acme Corp
ℹ Manually imported 5 days ago
```

### Inline Warnings

When displaying search results, show warnings at the top:

```
⚠ Using cached results for LinkedIn Jobs (source rate-limited)
   Cached 45 minutes ago • [Retry now]

⚠ 3 listings skipped from Indeed (malformed data)
   [View technical details]
```

### Actionable Messages

**Authentication required:**
```
⚠ Stack Overflow Jobs requires authentication
   [Configure API key]
```

**Rate limited:**
```
⚠ LinkedIn Jobs rate limit exceeded
   Automatic retry scheduled for 2:30 PM
   [Retry now] [Skip this source]
```

**Schema changed:**
```
⚠ Indeed response format has changed
   This source needs to be updated
   [Report issue] [Disable source]
```

---

## Testing Strategy

### Unit Tests for Adapters

**No live HTTP in CI.** Use fixtures and mock servers.

```typescript
describe("GitHubJobsAdapter", () => {
  it("returns success with valid response", async () => {
    const adapter = new GitHubJobsAdapter();
    const mockResponse = loadFixture("github-jobs-success.json");
    
    mockFetch(mockResponse, { status: 200 });
    
    const result = await adapter.retrieve(testQuery);
    
    expect(result.status).toBe("success");
    expect(result.listings).toHaveLength(10);
    expect(result.failure).toBeUndefined();
  });

  it("returns failure with rate-limit classification", async () => {
    const adapter = new GitHubJobsAdapter();
    
    mockFetch("", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
    
    const result = await adapter.retrieve(testQuery);
    
    expect(result.status).toBe("failure");
    expect(result.failure?.category).toBe("rate-limited");
    expect(result.failure?.retryable).toBe(true);
    expect(result.failure?.retryAfter).toBeDefined();
  });

  it("returns partial result when some records are malformed", async () => {
    const adapter = new GitHubJobsAdapter();
    const mockResponse = loadFixture("github-jobs-partial.json");
    
    mockFetch(mockResponse, { status: 200 });
    
    const result = await adapter.retrieve(testQuery);
    
    expect(result.status).toBe("partial");
    expect(result.listings).toHaveLength(8);
    expect(result.metadata.recordsRejected).toBe(2);
    expect(result.warnings).toHaveLength(2);
  });

  it("classifies timeout as retryable", async () => {
    const adapter = new GitHubJobsAdapter();
    
    mockFetchTimeout();
    
    const result = await adapter.retrieve(testQuery);
    
    expect(result.status).toBe("failure");
    expect(result.failure?.category).toBe("timeout");
    expect(result.failure?.retryable).toBe(true);
  });
});
```

### Integration Tests for Orchestration

```typescript
describe("SearchOrchestrator", () => {
  it("returns partial results when one source fails", async () => {
    const orchestrator = new SearchOrchestrator([
      mockAdapter("source-a", { status: "success", listings: 10 }),
      mockAdapter("source-b", { status: "failure", category: "timeout" }),
      mockAdapter("source-c", { status: "success", listings: 5 }),
    ]);

    const run = await orchestrator.execute(testQuery);

    expect(run.sourcesCompleted).toEqual(["source-a", "source-c"]);
    expect(run.sourcesFailed).toEqual(["source-b"]);
    expect(run.listingsAccepted).toBe(15);
    expect(run.coverageComplete).toBe(false);
    expect(run.summary).toContain("2 of 3 sources succeeded");
  });

  it("deduplicates listings across sources", async () => {
    const duplicateListing = { sourceRecordId: "job-123", /* ... */ };
    
    const orchestrator = new SearchOrchestrator([
      mockAdapter("source-a", { listings: [duplicateListing] }),
      mockAdapter("source-b", { listings: [duplicateListing] }),
    ]);

    const run = await orchestrator.execute(testQuery);

    expect(run.listingsDiscovered).toBe(2);
    expect(run.listingsDeduplicated).toBe(1);
    expect(run.listingsAccepted).toBe(1);
  });

  it("handles zero results with complete coverage", async () => {
    const orchestrator = new SearchOrchestrator([
      mockAdapter("source-a", { status: "success", listings: 0 }),
      mockAdapter("source-b", { status: "success", listings: 0 }),
    ]);

    const run = await orchestrator.execute(testQuery);

    expect(run.listingsAccepted).toBe(0);
    expect(run.coverageComplete).toBe(true);
    expect(run.summary).toContain("No listings found");
    expect(run.summary).not.toContain("failed");
  });

  it("handles zero results with incomplete coverage", async () => {
    const orchestrator = new SearchOrchestrator([
      mockAdapter("source-a", { status: "success", listings: 0 }),
      mockAdapter("source-b", { status: "failure", category: "timeout" }),
    ]);

    const run = await orchestrator.execute(testQuery);

    expect(run.listingsAccepted).toBe(0);
    expect(run.coverageComplete).toBe(false);
    expect(run.summary).toContain("incomplete");
  });
});
```

### Failure Simulation Tests

```typescript
describe("Failure Handling", () => {
  it("retries on transient network error", async () => {
    const adapter = new GitHubJobsAdapter();
    let attempts = 0;

    mockFetch(() => {
      attempts++;
      if (attempts < 3) {
        throw new Error("Network error");
      }
      return successResponse();
    });

    const result = await adapter.retrieve(testQuery);

    expect(attempts).toBe(3);
    expect(result.status).toBe("success");
  });

  it("does not retry on authentication error", async () => {
    const adapter = new GitHubJobsAdapter();
    let attempts = 0;

    mockFetch(() => {
      attempts++;
      return { status: 401 };
    });

    const result = await adapter.retrieve(testQuery);

    expect(attempts).toBe(1);
    expect(result.status).toBe("failure");
    expect(result.failure?.category).toBe("authentication-required");
    expect(result.failure?.retryable).toBe(false);
  });

  it("respects Retry-After header", async () => {
    const adapter = new GitHubJobsAdapter();
    const startTime = Date.now();

    mockFetch({
      status: 429,
      headers: { "Retry-After": "2" },
    });

    const result = await adapter.retrieve(testQuery);

    expect(result.failure?.retryAfter).toBeDefined();
    // Verify backoff calculation used Retry-After
  });

  it("escalates source to unavailable after 5 failures", async () => {
    const adapter = new GitHubJobsAdapter();
    
    for (let i = 0; i < 5; i++) {
      mockFetch({ status: 503 });
      await adapter.retrieve(testQuery);
    }

    const health = adapter.getHealth();
    expect(health.status).toBe("unavailable");
    expect(health.consecutiveFailures).toBe(5);
  });
});
```

### Deduplication Tests

```typescript
describe("Deduplication", () => {
  it("deduplicates by URL", async () => {
    const listing1 = { sourceUrl: "https://example.com/job/123" };
    const listing2 = { sourceUrl: "https://example.com/job/123" };

    const deduplicated = deduplicateListings([listing1, listing2]);

    expect(deduplicated).toHaveLength(1);
  });

  it("deduplicates by title+company when URL differs", async () => {
    const listing1 = {
      sourceUrl: "https://source-a.com/job/123",
      normalized: { title: "Engineer", company: "Acme" },
    };
    const listing2 = {
      sourceUrl: "https://source-b.com/job/456",
      normalized: { title: "Engineer", company: "Acme" },
    };

    const deduplicated = deduplicateListings([listing1, listing2]);

    expect(deduplicated).toHaveLength(1);
  });

  it("merges metadata for duplicates", async () => {
    const listing1 = {
      sourceUrl: "https://example.com/job/123",
      firstSeenAt: "2024-01-01T00:00:00Z",
      lastSeenAt: "2024-01-01T00:00:00Z",
    };
    const listing2 = {
      sourceUrl: "https://example.com/job/123",
      firstSeenAt: "2024-01-02T00:00:00Z",
      lastSeenAt: "2024-01-02T00:00:00Z",
    };

    const deduplicated = deduplicateListings([listing1, listing2]);

    expect(deduplicated[0].firstSeenAt).toBe("2024-01-01T00:00:00Z");
    expect(deduplicated[0].lastSeenAt).toBe("2024-01-02T00:00:00Z");
  });
});
```

---

## Implementation Guidance

### File Structure

```
packages/
├── domain/
│   └── src/
│       ├── retrieval/
│       │   ├── types.ts              # RetrievalResult, SearchRun, etc.
│       │   ├── failure-categories.ts # FailureCategory enum
│       │   └── verification.ts       # VerificationState logic
│       └── schemas.ts                # Add retrieval schemas
├── server/
│   └── src/
│       ├── adapters/
│       │   ├── base-adapter.ts       # Abstract adapter class
│       │   ├── github-jobs.ts
│       │   ├── linkedin.ts
│       │   └── index.ts
│       ├── orchestration/
│       │   ├── search-orchestrator.ts
│       │   ├── retry-policy.ts
│       │   └── rate-limiter.ts
│       ├── cache/
│       │   └── retrieval-cache.ts
│       └── db.ts                     # Add retrieval tables
└── frontend/
    └── src/
        ├── components/
        │   ├── SourceHealth.tsx
        │   ├── SearchCoverage.tsx
        │   └── ListingFreshness.tsx
        └── pages/
            └── SearchResults.tsx
```

### Database Schema Additions

```sql
-- Source health tracking
CREATE TABLE source_health (
  source_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  last_attempted_at TEXT,
  last_succeeded_at TEXT,
  consecutive_failures INTEGER DEFAULT 0,
  last_failure_category TEXT,
  earliest_retry_at TEXT,
  updated_at TEXT NOT NULL
);

-- Search runs
CREATE TABLE search_runs (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  sources_requested TEXT NOT NULL,
  sources_completed TEXT NOT NULL,
  sources_failed TEXT NOT NULL,
  listings_discovered INTEGER DEFAULT 0,
  listings_accepted INTEGER DEFAULT 0,
  listings_deduplicated INTEGER DEFAULT 0,
  coverage_complete BOOLEAN DEFAULT FALSE,
  summary TEXT
);

-- Listing provenance
CREATE TABLE listing_provenance (
  listing_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  application_url TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_verified_at TEXT,
  verification_state TEXT NOT NULL,
  source_record_id TEXT,
  normalization_version TEXT NOT NULL,
  FOREIGN KEY (listing_id) REFERENCES listings(id),
  FOREIGN KEY (source_id) REFERENCES source_health(source_id)
);

-- Retrieval cache
CREATE TABLE retrieval_cache (
  cache_key TEXT PRIMARY KEY,
  result TEXT NOT NULL,
  etag TEXT,
  last_modified TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
```

### Migration Path from Current Prototype

**Phase 1: Foundation (Milestone 3)**
- Add retrieval types to domain package
- Implement base adapter class
- Implement 1-2 concrete adapters with fixtures
- Build search orchestrator
- Add provenance tracking
- Implement basic caching

**Phase 2: Resilience (Milestone 3)**
- Add retry policies
- Implement rate limiting
- Add failure escalation
- Build source health tracking
- Implement verification workflow

**Phase 3: User Experience (Milestone 4)**
- Add coverage reporting UI
- Implement source health dashboard
- Add freshness indicators
- Build retry controls

### Backward Compatibility

- Manually imported listings get `verificationState: "manually-imported"`
- Existing `ImportSource` type extended, not replaced
- Current listing import flow continues to work
- No breaking changes to match assessment

---

## Summary

This design provides a foundation for resilient job-source retrieval that:

1. **Expects failure** and handles it gracefully
2. **Isolates sources** so one failure doesn't crash the search
3. **Reports honestly** about coverage and freshness
4. **Respects limits** with rate limiting and backoff
5. **Caches intelligently** to reduce load and improve performance
6. **Tracks provenance** so users know where listings came from
7. **Verifies carefully** without over-expiring listings

The contracts defined here are minimal and focused. They provide clear boundaries between adapters, orchestration, and the UI without over-engineering for speculative features.

Implementation should follow the phased approach, starting with basic adapters and orchestration, then adding resilience features, and finally polishing the user experience.
