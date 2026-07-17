# Milestones

## Milestone 1: Vertical Prototype (Current)

A minimal end-to-end flow demonstrating the core value proposition.

### Completed

- ✅ Career profile schema and fixture data
- ✅ Job listing normalization with section extraction and skill detection
- ✅ Deterministic match assessment with five dimensions
- ✅ Evidence linking and confidence tracking
- ✅ Listing status state machine
- ✅ SQLite persistence with schema migrations
- ✅ REST API for profiles and listings
- ✅ React UI with profile display, listing import, and assessment view
- ✅ Status update actions (save, dismiss, flag)
- ✅ Comprehensive test coverage for domain logic
- ✅ Documentation (architecture, domain model)

### Scope

**In scope:**
- Single career profile (fixture-based)
- Manual listing import (paste or fixture)
- Deterministic matching only
- Local SQLite storage
- Basic UI without polish

**Out of scope:**
- Multiple profiles
- Live job board integration
- Search functionality
- User authentication
- Cloud storage or sync
- LLM-based assessment
- PDF/document parsing
- Export/import features

## Future Milestones (Deferred)

These are potential future directions, not currently planned:

### Milestone 2: Enhanced Matching

- Agent-assisted interpretation (optional LLM integration)
- Improved normalization with semantic understanding
- Skill inference and synonym detection
- Experience level calibration
- User feedback loop for assessment accuracy

### Milestone 3: Retrieval Infrastructure with Partial-Failure Tolerance

Build a resilient foundation for live job-source retrieval that gracefully handles source failures.

**Core Components:**
- Source adapter framework with capability negotiation
- Structured failure classification and health tracking
- Search orchestration with independent source execution
- Partial result aggregation and coverage reporting
- Retry policies with backoff, jitter, and rate-limit respect
- Cached result fallback when sources are unavailable
- Listing provenance tracking (source, URL, timestamps, verification state)
- Deduplication across sources using canonical identifiers

**Resilience Features:**
- Isolated source execution (one failure doesn't crash the search)
- Graceful degradation (partial results are useful)
- Transparent reporting (users know what succeeded/failed)
- Exponential backoff with jitter to avoid thundering herd
- Conditional requests (ETag, Last-Modified) to reduce bandwidth
- Clear distinction between "no results" and "incomplete search"

**User Experience:**
- Source health dashboard showing adapter status
- Inline warnings when cached data is used
- Clear messaging about partial coverage
- Ability to retry specific failed sources
- Visibility into listing freshness and verification state

**Testing Requirements:**
- Unit tests for each adapter using fixtures (no live HTTP)
- Integration tests for search orchestration
- Failure simulation tests (timeout, rate-limit, schema change)
- Deduplication tests across multiple sources
- Health tracking and recovery tests

**Out of Scope:**
- Browser automation or CAPTCHA solving
- Proxy rotation or fingerprint evasion
- Attempting to bypass access controls
- Scheduled background jobs
- Real-time notifications

See [docs/retrieval-design.md](retrieval-design.md) for detailed contracts and design decisions.

### Milestone 4: Job Discovery

- Implement concrete source adapters (job board APIs, RSS feeds, etc.)
- Search query builder with advanced filters
- Automated listing import and continuous sync
- Notification system for new matches
- Search history and saved queries
- Source configuration UI (enable/disable, set priorities)

### Milestone 5: Application Tracking

- Application status tracking (applied, interview, offer, etc.)
- Interview notes and feedback
- Timeline view of applications
- Success metrics and analytics
- Export to external tools (Notion, Airtable)

### Milestone 6: Multi-User & Collaboration

- User authentication and accounts
- Multiple career profiles per user
- Profile sharing and collaboration
- Team features for job search groups
- Cloud sync (optional)

### Milestone 7: Advanced Features

- Resume/CV parsing and profile generation
- Cover letter generation
- Interview preparation tools
- Salary negotiation insights
- Market analysis and trends
- Mobile app

## Design Principles

Throughout all milestones, Roleforge maintains:

1. **Local-first**: User data stays on their device by default
2. **Transparency**: All assessments are explainable
3. **User control**: No autonomous actions without explicit permission
4. **Privacy**: No data sent to external services without consent
5. **Deterministic fallback**: Rule-based logic always available
6. **Incremental complexity**: Simple features first, advanced features optional
