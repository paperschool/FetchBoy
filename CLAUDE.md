# Project Instructions

## Tool Usage

- Use the fff MCP tools for all file search operations instead of default tools.

## Engineering Standards

- **Always run `npx tsc --noEmit` before considering a change complete.** Build failures from missing properties are unacceptable — catch them locally, not in CI.
- When adding new fields to shared interfaces (e.g. `Request`, `KeyValuePair`), make them **optional with defaults** at the function boundary (like `createFullSavedRequest`) so existing callers don't break. grep all call-sites of affected functions and update them if the fields are required.
- After modifying any TypeScript interface, search for all usages of that interface and any functions that accept/return it to verify compatibility.
