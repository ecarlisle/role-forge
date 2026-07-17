# Roleforge

Local-first job-search intelligence workspace.

Roleforge helps you evaluate job opportunities against your career profile using deterministic matching rules. Import job listings, get structured assessments, and track your decisions—all stored locally on your machine.

## Features

- **Career Profile Management**: Define your skills, experience, and preferences
- **Job Listing Import**: Paste job descriptions or load sample fixtures
- **Deterministic Matching**: Get transparent, explainable match assessments
- **Decision Tracking**: Save, dismiss, or flag listings for review
- **Local-First**: All data stored in SQLite on your machine

## Quick Start

```bash
# Install dependencies
bun install

# Seed the database with sample data
bun run seed

# Start development servers
bun run dev
```

Open http://localhost:5173 to view the application.

## Development

```bash
# Run tests
bun run test

# Run tests in watch mode
bun run test:watch

# Type checking
bun run typecheck

# Linting
bun run lint

# Formatting
bun run format
```

## Architecture

Roleforge is organized as a Bun workspace with three packages:

- **domain**: Pure TypeScript business logic (schemas, normalization, matching, state transitions)
- **server**: Bun HTTP server with SQLite persistence
- **frontend**: Vite + React application

The domain package is independent of React, HTTP, SQLite, and model providers.

See [docs/architecture.md](docs/architecture.md) for details.

## Project Structure

```
roleforge/
├── packages/
│   ├── domain/       # Core business logic
│   ├── server/       # HTTP API and database
│   └── frontend/     # React UI
├── fixtures/         # Sample data
└── docs/            # Documentation
```

## Technology Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **Frontend**: React + Vite
- **Database**: SQLite (bun:sqlite)
- **Validation**: Zod
- **Testing**: Vitest + React Testing Library

## License

ISC
# role-forge
