# CWEST Ascension System

A teacher-controlled skill tree for recognizing creative growth. **Miller supplies the judgment. The application records and displays his decisions.**

This is an initial development prototype for review, with fictional demo records. It has server-side account enforcement and SQLite persistence, but it has **not** been deployed for students or connected to school Google accounts.

## Try the Fictional Demo

Install Node.js **24 or later**, then:

```sh
git clone https://github.com/AbbyUsesAIThatCodes/CwestAscensionSystem.git
cd CwestAscensionSystem
git checkout feat/initial-ascension-prototype
npm run demo
```

Open **http://127.0.0.1:3000**. No `npm install` is required. Select a fictional teacher or student account on the demo sign-in screen.

The demo binds to loopback only and writes to `data/demo.sqlite`. Do not expose it through a tunnel, public host, or reverse proxy, and do not enter real student information. Its account buttons are intentionally available only in demo mode. Reloading or restarting preserves the demo changes.

## A Five-Minute Review

1. Open the teacher demo and select a student. Explore the radial tree, then switch to its accessible list view.
2. Choose a badge and record a rank. A note is optional. Confirm the change in that student's view.
3. Remove a rank or undo a batch in history. Visibility changes never award another badge automatically.
4. Open the badge and tree editors. Create a short rank ladder, position a node, and combine reveal conditions with All Of or Any Of.
5. Preview the other student. Each account receives only its own permitted records, not the teacher's full model.

The seed catalog and visibility examples are drafts for demonstrating the controls, not Miller's approved curriculum or actual students' achievements.

## Included

- Teacher and private student interfaces, plus teacher-only student preview.
- Class filtering and roster management.
- Manual, bulk badge awards, removals, optional private/shared notes, and audited undo with protection against overwriting later awards.
- Editable badges, per-badge rank ladders, and radial tree placement.
- Named or unnamed silhouettes, hidden nodes, nested reveal conditions, and individual show/hide overrides.
- A teacher-only Ohio course mapping structure, separate from attainment.
- Persistent SQLite storage, server-side authorization, password hashing, opaque expiring sessions, CSRF checks, and security-focused tests.

See [Scope](docs/SCOPE.md) for confirmed boundaries and reversible defaults. There are no grades, automatic assessments, mandatory rubrics, evidence-submission queues, peer reviews, career pathways, or leaderboards.

## Account Mode and School Setup

The non-demo server does not allow public registration and refuses to start without an explicitly provisioned teacher. It uses a different database (`data/production.sqlite`) and cannot open a database marked as a demo.

An authorized operator can provision a teacher locally. Keep passwords out of command history and source files:

```sh
export CWEST_ACCOUNT_NAME='Teacher Display Name'
read -rsp 'New password (12+ characters): ' CWEST_ACCOUNT_PASSWORD; echo
export CWEST_ACCOUNT_PASSWORD
node scripts/accounts.mjs create teacher-login teacher
unset CWEST_ACCOUNT_PASSWORD CWEST_ACCOUNT_NAME
```

After arranging HTTPS termination, an operator can start the account-mode server behind an HTTPS reverse proxy:

```sh
CWEST_HTTPS=1 npm start
```

The default bind address remains `127.0.0.1`. `CWEST_HTTPS=1` is an operator assertion, **not** an implementation of TLS. Account-mode cookies are Secure and will not work on ordinary HTTP. Do not set that flag until HTTPS is actually configured and verified.

The teacher creates roster entries in the interface. Provision each student account with its exact roster ID using `node scripts/accounts.mjs create LOGIN student STUDENT_ID`, with the same securely supplied name/password variables. Never share teacher credentials. `node scripts/accounts.mjs list` lists provisioned identities; `node scripts/accounts.mjs revoke LOGIN` revokes the account and its sessions.

Environment options: `PORT` (default 3000), `HOST` (default 127.0.0.1), and `CWEST_DB` (explicit SQLite path). Demo and account-mode databases must remain separate.

Before using any real records, the school must approve hosting, identity provisioning, access, retention, backup/restore, and privacy practices. Configure TLS, verify account recovery and offboarding, and test the deployed access boundaries. This prototype is not a compliance certification. School Google sign-in, Classroom roster sync, and automated password recovery are not implemented. A Classroom link can be an entry point later; it is not an access-control mechanism.

See [Security and Operations](docs/SECURITY.md) for the concrete deployment checklist and limitations.

## Validate and Build

```sh
npm run check
npm run build
```

Checks include JavaScript syntax, backend integration/security cases, and build-identity consistency. Browser review steps are in [Review Guide](docs/REVIEW.md). The code has no third-party runtime dependencies.

A build creates `dist/<complete-build-id>/` with a fixed manifest and build report. Start it from that directory with `npm run demo`. The footer, directory, console, manifest, and report use the same identity. [Build Identity](docs/BUILD_IDENTITY.md) explains local and PR-scoped allocation. No release codename has been chosen.

## Important Prototype Limits

- No hosting or actual school sign-in has been configured, and no real class records are included.
- SQLite currently stores the application model as a transactional JSON snapshot, alongside SQL account/session tables. This is persistent SQL-backed storage, not a normalized analytics warehouse.
- Badge rank labels with existing award history cannot be silently changed. A deliberate rank-migration editor is not implemented.
- The graphical catalog is capped at 100 nodes per tree in this prototype. It is not validated for district-scale concurrent use.
- Undo protects award versions. Configuration forms do not yet provide multi-editor conflict resolution; use one teacher editing session at a time.
- Rich media uploads, imports, in-app backup/restore, and automated curricular alignment are not included.

Do not merge or deploy solely because the review checks pass. Review the draft pull request and test the actual hosting and identity setup first.
