# CWEST Ascension System

## Scope

Miller interprets student work. This application records his badge and rank decisions. Do not add mandatory rubrics, lesson tracking, evidence submission, grades, leaderboards, peer review, career pathways, or automated assessment without a new request.

Keep skill identity separate from tree placement. Revealing a node never awards a rank. Preserve server-side filtering of hidden nodes, rules, teacher notes, mappings, and other students' records.

## Development

- Node.js 24 or later. No application dependencies are required.
- Run `npm run check` before committing. Run the local browser smoke workflow after UI changes.
- Use Title Case for authored UI headings and titles, not ordinary prose or identifiers.
- Follow `docs/BUILD_IDENTITY.md` for every distributable build.
- Never commit student records, passwords, databases, sessions, screenshots of real records, or source conversations.
- Keep the demo fictional, separate, and loopback-only. Never call it a school deployment.
- Preserve audit history and reject unsafe rank remapping.
- Open review changes as draft pull requests. Do not merge or deploy without authorization.
