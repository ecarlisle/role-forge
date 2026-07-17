# Architecture

## Overview

Roleforge follows a clean separation of concerns across three packages in a Bun monorepo:

- **domain**: Pure TypeScript business logic with zero infrastructure dependencies
- **server**: HTTP API and SQLite persistence layer
- **frontend**: React user interface

This architecture ensures that core domain logic remains testable, portable, and independent of UI frameworks, HTTP clients, or database drivers.

## Package Boundaries

### Domain Package

The domain package contains all business logic and validation schemas. It has no dependencies on React, HTTP, SQLite, or external services.

**Responsibilities:**
- Define Zod schemas for all data structures
- Normalize raw job listings into structured format
- Evaluate job-profile matches using deterministic rules
- Manage listing status state transitions

**Key modules:**
- `schemas.ts` — Zod schemas and TypeScript types
- `normalize-listing.ts` — Job listing normalization
- `evaluate-match.ts` — Match assessment logic
- `listing-status.ts` — Status state machine

### Server Package

The server package provides a RESTful HTTP API and manages SQLite persistence.

**Responsibilities:**
- Expose HTTP endpoints for profiles and listings
- Persist data to SQLite using bun:sqlite
- Load and validate fixtures
- Handle CORS for local development

**Key modules:**
- `db.ts` — Database initialization and schema
- `api.ts` — HTTP server and route handlers
- `seed.ts` — Fixture loading script

### Frontend Package

The frontend package is a Vite + React application that provides the user interface.

**Responsibilities:**
- Display career profiles and job listings
- Render match assessments with explanations
- Handle user interactions (import, save, dismiss, flag)
- Communicate with server via HTTP API

**Key modules:**
- `App.tsx` — Main application component
- `api.ts` — HTTP client for server communication
- `components/` — React components for UI elements

## Data Flow

1. **Profile Loading**: Frontend fetches career profiles from server API
2. **Listing Import**: User pastes text or loads fixture → Frontend POSTs to server
3. **Normalization & Assessment**: Server normalizes listing and evaluates match against profile
4. **Persistence**: Server stores normalized listing and assessment in SQLite
5. **Display**: Frontend renders listing with assessment details
6. **Status Updates**: User changes status → Frontend PATCHes server → Database updated

## Key Design Decisions

### Deterministic Matching

Match assessments use rule-based logic rather than machine learning or LLMs. This ensures:
- **Transparency**: Every match dimension has an explanation
- **Reproducibility**: Same inputs always produce same outputs
- **Speed**: No external API calls or model inference
- **Offline operation**: Works without internet connection

### Conservative Normalization

Job listing normalization is deliberately conservative:
- Only extracts clearly labeled sections
- Uses controlled vocabulary for skill detection
- Represents missing data explicitly with null values
- Tracks confidence levels for each extracted field
- Never invents or hallucinates data

### Categorical Verdicts

Match assessments use categorical verdicts rather than percentages:
- `strong` — Excellent alignment
- `promising` — Good match with minor gaps
- `mixed` — Some alignment, some concerns
- `weak` — Poor alignment
- `insufficient-evidence` — Cannot assess reliably

Each verdict is supported by dimension-level breakdowns and evidence linking.

### Local-First Storage

All data is stored in a local SQLite database (`data/roleforge.db`):
- No cloud services or external APIs required
- User maintains full control of their data
- Database is gitignored and not committed to repository
- Easy to backup, export, or migrate

## Technology Choices

- **Bun**: Fast runtime with built-in TypeScript support and SQLite driver
- **TypeScript**: Type safety across all packages
- **React**: Component-based UI with good ecosystem support
- **Vite**: Fast development server and build tool
- **SQLite**: Embedded database, no server process required
- **Zod**: Runtime validation with TypeScript type inference
- **Vitest**: Fast testing framework compatible with Vite

## Development Workflow

- **Concurrent dev servers**: Vite (frontend) and Bun (server) run in parallel
- **Shared types**: Domain package exports types used by server and frontend
- **Workspace dependencies**: Packages reference each other via `workspace:*`
- **Automatic reload**: Server uses `--watch` mode, Vite has HMR

## Testing Strategy

- **Domain tests**: Comprehensive unit tests for normalization, matching, and state transitions
- **Schema tests**: Validation tests for all Zod schemas
- **Integration tests**: Server persistence tests (using bun:sqlite)
- **UI tests**: Component tests with React Testing Library

## Future Considerations

This architecture supports future extensions while maintaining current simplicity:

- **Agent integrations**: Could add LLM-based assessment as optional enhancement
- **Multiple profiles**: Schema supports multiple career profiles per user
- **Search integration**: Could add job board APIs without changing core domain
- **Export/import**: SQLite makes it easy to export data for backup or migration

## Future: Retrieval and Partial Failure Model

When Roleforge integrates live job sources, it must account for the reality that external sources are unreliable. The architecture will evolve to support **resilient, partial-failure-tolerant retrieval**.

### Core Principle

> A source failure should reduce coverage, not corrupt the search or crash the application.

### Architectural Implications

**Source Adapters** will be isolated, testable units that:
- Encapsulate source-specific HTTP logic
- Return structured results (not just throw exceptions)
- Report their own health status
- Support capability negotiation

**Search Orchestration** will:
- Execute sources independently and in parallel
- Aggregate partial results even when some sources fail
- Track provenance for every listing
- Distinguish between "no results found" and "incomplete search"

**Failure Handling** will:
- Classify failures into retryable vs non-retryable categories
- Respect rate limits, timeouts, and backoff policies
- Fall back to cached results when fresh data is unavailable
- Never attempt to bypass access controls

**Listing Verification** will:
- Track freshness and origin for every listing
- Distinguish active, stale, and unverifiable listings
- Avoid automatic expiration based on single verification failures

**User Experience** will:
- Clearly communicate partial coverage
- Explain why specific sources failed
- Show when cached data is being used
- Never present incomplete results as complete

For detailed contracts and design decisions, see [docs/retrieval-design.md](retrieval-design.md).

This model will be implemented in a future milestone (see [docs/milestones.md](milestones.md)) and will not affect the current vertical prototype.
