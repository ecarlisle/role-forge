# Biome Configuration: Disabled Rules and Rationale

This document explains the Biome lint rules that have been deliberately disabled or modified from the recommended configuration.

## Disabled Rules

### `complexity/noForEach` (off)

**Reason:** The project frequently uses functional patterns where `.forEach()` is more readable than `.map()` when side effects are intentional and no return value is needed. For example, when iterating over test fixtures or processing lists for logging/debugging purposes, `.forEach()` clearly communicates intent without requiring developers to handle unused return values.

**Alternative considered:** Using `for...of` loops, but `.forEach()` is more concise for simple iterations and aligns with the functional style used throughout the codebase.

### `style/useNodejsImportProtocol` (off)

**Reason:** This rule recommends using the `node:` prefix for Node.js built-in modules (e.g., `import { join } from "node:path"`). However, TypeScript's default configuration does not recognize the `node:` prefix without additional setup (installing `@types/node` and configuring `moduleResolution`). Since the project uses Bun's built-in TypeScript support and the standard import style works correctly, this rule is disabled to avoid unnecessary configuration complexity.

**Alternative considered:** Installing `@types/node` and configuring TypeScript to support `node:` imports, but this adds complexity without functional benefit since the standard imports work correctly.

## Modified Rules (Warnings Instead of Errors)

### `suspicious/noExplicitAny` (warn)

**Reason:** While avoiding `any` is generally good practice, the current codebase uses `any` in several legitimate contexts:
- Repository functions that deserialize JSON from SQLite (where the exact type isn't known at compile time)
- Test mocks and fixtures where strict typing would add complexity without value
- Migration from external data sources with incomplete type definitions

These uses are intentional and documented. Downgrading to a warning allows the linter to flag potentially problematic `any` usage while not blocking legitimate use cases.

**Future improvement:** Gradually replace `any` with `unknown` and proper type guards where feasible.

### `style/noNonNullAssertion` (warn)

**Reason:** Non-null assertions (`!`) are used in several places where the code logic guarantees non-null values but TypeScript's type system cannot infer this:
- DOM element references after explicit null checks
- Array/object access after existence validation
- Test assertions where setup guarantees presence

Downgrading to a warning allows these intentional uses while still flagging potentially unsafe assertions.

**Future improvement:** Refactor to use proper null checks or type guards where possible.

### `correctness/useExhaustiveDependencies` (warn)

**Reason:** React hooks in the frontend occasionally intentionally omit dependencies to control re-render behavior or avoid infinite loops. For example, effects that should only run on mount or when specific dependencies change, but not others.

**Usage pattern:** When a dependency is intentionally omitted, it should be documented with a comment explaining why.

## Enabled Rules (Recommended)

All other recommended rules are enabled, including:

- **Accessibility (a11y)**: Full recommended set enabled to ensure JSX components are accessible
- **Correctness**: Unused imports and variables are errors (not warnings) to keep the codebase clean
- **Suspicious**: Catches potential bugs like unused expressions, duplicate conditions, etc.
- **Style**: Enforces consistent code style (const over let, proper naming conventions, etc.)

## Import Organization

Import organization is **enabled**. Biome automatically sorts and groups imports according to best practices:
1. Built-in Node modules
2. External dependencies
3. Relative imports (grouped by depth)
4. Side-effect imports

This ensures consistent import ordering across the codebase without manual intervention.

## Formatter Configuration

The formatter uses:
- **2-space indentation** (spaces, not tabs) for consistency with TypeScript/React conventions
- **100 character line width** to balance readability with horizontal space
- **Double quotes** for strings (JavaScript/TypeScript standard)
- **Semicolons** for statement termination (explicit over implicit)
- **Trailing commas** in multi-line structures for cleaner diffs

These settings align with modern TypeScript/React best practices and are enforced consistently across all packages.

## File Exclusions

The following are excluded from linting and formatting:
- `node_modules/` - Third-party dependencies
- `dist/` - Build output
- `coverage/` - Test coverage reports
- `data/` - Runtime SQLite database files
- `*.db`, `*.sqlite` - Database files
- `.git/` - Version control metadata
- `bun.lockb` - Lockfile (binary format)

These exclusions prevent noise from generated or external files.

## Validation Workflow

When making changes, run the following in order:

1. **`bun run check`** - Fast feedback on lint/format issues
2. **`bun run typecheck`** - TypeScript compilation check
3. **`bun test`** - Run test suite
4. **`bun run build`** - Verify production build

Use **`bun run check:write`** to automatically fix safe formatting and lint issues before committing.

## Future Considerations

As the codebase matures, consider:
- Upgrading `noExplicitAny` warnings to errors and systematically replacing `any` with proper types
- Upgrading `noNonNullAssertion` warnings to errors and using proper null checks
- Enabling stricter rules as the team becomes more familiar with TypeScript patterns
- Adding custom rules for project-specific patterns (if needed)

The current configuration balances strictness with pragmatism, allowing the team to ship working code while maintaining quality standards.
