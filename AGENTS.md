# AGENTS.md

## Project

Roleforge is an experimental, open-source, local-first job-search intelligence workspace.

It helps users provide career context, define search preferences, review discovered job listings, evaluate matches against verified career evidence, and manage promising opportunities.

The current milestone is a small vertical prototype. Do not expand the project into a complete job-search platform without an explicit request.

## Core Principle

Agents make judgments. Conventional code performs repeatable operations.

Use deterministic code for:

* HTTP retrieval
* Parsing
* Validation
* Normalization
* Deduplication
* Persistence
* Source verification
* Scheduling
* State transitions

Agent or model integrations may later assist with:

* Search-strategy generation
* Job-description interpretation
* Evidence matching
* Match explanations
* Search refinement

Do not use an LLM where straightforward application logic is sufficient.

## Product Principles

Prefer:

* Local-first storage
* Transparent and inspectable decisions
* Verified career evidence
* User control
* Privacy
* Accessibility
* Replaceable model providers
* Testable domain logic
* Small, coherent changes

Avoid:

* Unexplained match scores
* Autonomous job applications
* Hidden résumé uploads
* Provider lock-in
* Premature distributed architecture
* Speculative abstractions
* Unnecessary frameworks or services

## Current Scope

The initial prototype should support:

1. Loading a sample career profile from local JSON
2. Importing a job listing from plain text or a local fixture
3. Normalizing the listing
4. Running a deterministic match assessment
5. Displaying the listing and assessment
6. Saving, dismissing, or flagging the listing for review
7. Persisting local state

Do not add the following unless explicitly requested:

* Live job-board integrations
* Web scraping
* Browser automation
* Scheduled searches
* Authentication
* Cloud persistence
* Vector databases
* Résumé PDF or DOCX parsing
* External model calls
* Automated applications
* Electron or Tauri packaging

## Technical Direction

Use:

* TypeScript
* Bun
* React
* Vite
* SQLite
* Zod

Keep domain logic independent from React, persistence, HTTP clients, and model providers.

Do not introduce a large framework or infrastructure dependency without documenting why the existing stack is insufficient.

## Domain Boundaries

Keep these concerns separate:

* Career evidence
* Search intent
* Job-source retrieval
* Listing normalization
* Match evaluation
* Application workflow
* Persistence
* UI
* Agent integrations

Search intent determines what the application looks for.

Career evidence and matching rules determine how listings are evaluated.

Preserve source provenance for all imported or discovered listings.

## Development Commands

Use the scripts defined in `package.json`.

Expected commands:

* `bun install`
* `bun run dev`
* `bun run build`
* `bun run typecheck`
* `bun run test`
* `bun run lint`
* `bun run format`
* `bun run format:check`
* `bun run check`
* `bun run check:write`

Run relevant checks before completing a change.

For changes affecting shared domain logic, run at minimum:

* `bun run typecheck`
* `bun run test`

For broader implementation changes, run the complete validation sequence:

* `bun run check`
* `bun run typecheck`
* `bun run test`
* `bun run build`

## Testing

Add or update tests when changing:

* Listing normalization
* Match calculations
* Validation schemas
* Deduplication
* Persistence behavior
* Domain state transitions

Prefer fixtures that resemble realistic job listings and career evidence.

Tests should verify explanations and evidence links, not only numeric scores.

## Data and Privacy

Treat résumé data, career history, contact information, recruiter messages, and application records as private user data.

Do not send user data to an external model or service without explicit configuration and user action.

Fixtures must not contain real private contact information.

Use clearly fictional data unless the user explicitly provides material intended for the repository.

## Match Evaluation

Match results must remain explainable.

A match assessment should identify:

* Strong matches
* Partial matches
* Missing evidence
* Concerns
* Relevant career evidence
* Recommended next action

Do not present a percentage without showing the factors and evidence behind it.

Deterministic matching should remain available even if agent-backed evaluation is later added.

## Code Style

* Prefer clear names over abbreviated names.
* Keep functions focused.
* Avoid premature generic frameworks.
* Avoid interfaces with only one speculative implementation.
* Validate data at system boundaries.
* Keep UI components separate from domain calculations.
* Add comments only where intent is not evident from the code.

Use `bun run format` to apply consistent formatting. Use `bun run lint` to check for code quality issues. Both commands use Biome, which is configured in `biome.json` at the repository root. See `docs/biome-configuration.md` for details on disabled rules and their rationale.

## Documentation

Update documentation when changing:

* Architectural boundaries
* Domain concepts
* Major dependencies
* Persistence strategy
* Agent responsibilities
* Milestone scope

Relevant files include:

* `README.md`
* `docs/architecture.md`
* `docs/domain-model.md`
* `docs/milestones.md`
* `AGENTS.md`

Do not duplicate large sections between documents. Link to the authoritative document instead.

## External Integrations and Partial-Failure Handling

When implementing live job-source retrieval (Milestone 3), follow these principles:

### Core Principle

> A source failure should reduce coverage, not corrupt the search or crash the application.

### Required Behaviors

**Source Isolation:**
- Execute sources independently; one failure must not block others
- Each source adapter must return structured results, not just throw exceptions
- Wrap all HTTP calls in try-catch with explicit failure classification

**Failure Classification:**
- Classify every failure into a stable taxonomy (network-error, timeout, rate-limited, authentication-required, etc.)
- Distinguish retryable failures (timeout, rate-limit) from non-retryable (auth-denied, blocked)
- Never expose raw stack traces or internal errors to users

**Retry Policies:**
- Respect `Retry-After` headers when present
- Use exponential backoff with jitter to avoid thundering herd
- Set maximum retry attempts (e.g., 3-5) and total timeout
- Never retry non-retryable failures
- Track consecutive failures per source and escalate to "unavailable" status

**Rate Limiting:**
- Implement per-source rate limits (requests per minute/hour)
- Queue requests that exceed rate limits
- Respect 429 responses and backoff accordingly
- Never attempt to bypass rate limits with multiple connections

**Caching and Fallback:**
- Cache successful results with appropriate TTL
- Fall back to cached data when a source is temporarily unavailable
- Clearly mark cached results as "stale" with last-fetched timestamp
- Never present cached data as fresh without disclosure

**Listing Provenance:**
- Track source ID, URL, and retrieval timestamp for every listing
- Record verification state (active-verified, active-stale, source-unavailable, etc.)
- Store original payload reference for debugging
- Never modify provenance metadata after initial creation

**Deduplication:**
- Deduplicate listings across sources using canonical identifiers (URL, job ID, title+company)
- Merge metadata when duplicates are found (earliest first-seen, latest last-verified)
- Track which sources provided each listing

**User Communication:**
- Always report search coverage (e.g., "3 of 5 sources succeeded")
- Explain failures in user-friendly terms ("GitHub Jobs is temporarily unavailable")
- Distinguish "no results found" from "incomplete search"
- Show source health status in UI (healthy, degraded, unavailable)
- Allow users to retry specific failed sources

### Prohibited Behaviors

Do not:
- Attempt to bypass CAPTCHAs or access controls
- Use proxy rotation or fingerprint evasion
- Ignore robots.txt or terms of service
- Retry failed requests indefinitely
- Hide partial failures from users
- Present cached data as fresh without disclosure
- Share credentials or API keys across sources
- Make parallel requests that exceed rate limits

### Testing Requirements

All source adapters and orchestration logic must include:
- Unit tests with fixtures (no live HTTP in CI)
- Failure simulation tests (timeout, rate-limit, auth-error, schema-change)
- Partial-failure tests (some sources succeed, others fail)
- Deduplication tests across multiple sources
- Health tracking and recovery tests

See [docs/retrieval-design.md](retrieval-design.md) for detailed contracts and implementation guidance.

## Completing Work

At the end of a task, report:

* What changed
* Important decisions
* Files added or modified
* Validation commands run
* Results of tests and type-checking
* Known limitations
* Deliberately deferred work
