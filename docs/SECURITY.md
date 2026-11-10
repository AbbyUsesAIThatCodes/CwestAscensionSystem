# Security and Operations

## Implemented Access Boundaries

- The server decides roles and student identity from a stored session. A client-side route or selector cannot grant teacher access.
- Teachers are explicitly provisioned through an operator command. There is no first-visitor administrator, domain-wide teacher role, public signup, or student role-switch control.
- Passwords are salted and hashed with scrypt. Session tokens are random, stored hashed, expire after eight hours, and are carried by HttpOnly/SameSite=Strict cookies. Account-mode cookies also have Secure.
- Authenticated writes require a session CSRF token. API writes require JSON, and cross-origin/cross-site requests are rejected.
- Login failures are rate limited. The current limiter is per server process and remote socket address; place a properly configured rate-limiting HTTPS proxy in front of any real deployment. Do not trust arbitrary forwarded headers.
- Student responses are constructed on the server. They exclude other students, teacher notes, mappings, and reveal-rule metadata. Hidden nodes are omitted rather than concealed only with CSS.
- Teacher preview uses the same student projection. Manual visibility overrides do not alter awards.
- The demo is explicitly fictional and loopback-only, with a distinct database marker. Its account buttons must never be exposed publicly.

Automated tests verify important boundaries, not the absence of all vulnerabilities. This is an initial prototype, not an independently audited production system.

## Before Real Student Use

1. Obtain school approval for the host, data handling, account route, authorized staff, retention period, and incident response.
2. Use a maintained Node.js 24+ runtime and a dedicated service account. Keep the database directory out of the web root and restrict OS access.
3. Configure and verify HTTPS at a reverse proxy. Keep the application bound to loopback, restrict direct access, and apply request/body/time/rate limits. Set `CWEST_HTTPS=1` only after TLS is working.
4. Verify the exact teacher account and a one-to-one student-to-roster mapping. Test with two nonprivileged accounts that neither can read or write the other's records.
5. Decide school Google sign-in and account recovery with the school. Neither is implemented in this prototype. Provisioning a local account does not establish school approval.
6. Configure secure backups, test restoration on a separate machine, and document who can access them. SQLite's WAL must be handled correctly; use its online backup API or stop the server and back up the complete database state. Do not copy only the main file while writes are active.
7. Test logout, expiry, account revocation, restart persistence, visibility overrides, archived records, and password changes via controlled revocation/reprovisioning.
8. Review accessibility, school-device compatibility, monitoring, operational capacity, and retention. Do not use technical checks as a legal compliance claim.

## Storage and Concurrency

Account and session records are SQL tables. The badge/roster/tree/history model is one transactional JSON snapshot inside SQLite. Writes run under `BEGIN IMMEDIATE`; bulk awards and undo are atomic. The model is appropriate for reviewing one teacher's workflow, not an assertion of high-load or multi-school capacity.

Configuration edits use the submitted form's complete entity. They currently lack optimistic stale-save protection, so use one editing session. Award undo does check record versions and rejects a stale batch without changing any awards. Audit history is retained; no deletion or edit interface for it is provided.

## Sensitive Inputs

Never commit database files, account secrets, actual student records, browser captures of student data, private conversation transcripts, or school credentials. Do not place secrets in `.env` files checked into Git. The repo contains only clearly fictional seed identities and test-only password fixtures.

External badge URLs and evidence uploads are not supported. Icons are selected from a built-in set; this avoids third-party image requests that could disclose student activity.

## Reporting

Do not report sensitive vulnerabilities or real records in a public issue. Share a minimal private report with the repository owner and keep student details out of logs and screenshots.
