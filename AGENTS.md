# Repository Agent Instructions

## Required validation for code changes
- Always run Playwright coverage before finishing a task.
- Minimum required check for non-doc changes: `npm run test:playwright`.
- If you changed gameplay or UI behavior, also run full tests: `npm test`.
- Report the exact commands and outcomes in the final message.

## Recommended order
1. `npm run test:playwright`
2. `npm test`

## Notes
- Do not skip Playwright due to time; if blocked by environment issues, report the concrete failure and attempted command.
