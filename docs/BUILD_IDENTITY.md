# Build Identity

## Release Contract

`release.json` is the authoritative release record. Version 0.1.0 is an initial development prototype, not a stable production data contract. No codename has been agreed; `codename: null` and the filesystem slug `Unassigned` make that explicit. Do not turn that placeholder into an accepted release name.

## One Manifest Per Build

Run `npm run build` for an explicitly local build. The build script reserves an ordinal before copying any output, captures UTC once, records the full Git revision, dirty state, and a SHA-256 fingerprint of inputs, then emits one immutable manifest. Failed reservations remain consumed. Reopening or retesting an existing output does not make a new build.

Output is enclosed by `dist/<full-build-id>/`. The same ID appears in the start/success/failure console, `build-info.json`, `public/build-info.json`, the app footer, and `BUILD_REPORT.md`. A live checkout shows a live-development label instead of inventing a build time.

## Durable Allocation

Local invocations use `.build/local-ledger.json`, with a unique session scope and monotonic counter. An exclusive filesystem lock serializes reservations; an atomic rename and fsync protect the ledger. A new checkout is a new explicitly local scope, not a reset PR counter.

For a real PR build, use:

```sh
npm run build -- --pr ACTUAL_PR_NUMBER --ledger /absolute/persistent/cwest-build-ledger.json
```

All artifact-producing invocations for that PR, including reruns and local builders, must use this **same authoritative durable allocator**. Store it outside disposable checkouts and back it up. The lock is held through completion. Never copy the ledger to another machine and build from both copies. If a centrally accessible allocator is unavailable, build in explicit local scope; the script refuses a PR build without an explicit absolute ledger path. Never substitute a workflow run number for the PR-local ordinal.

After a crashed builder, investigate its process and reservation before removing a stale lock. Retain the consumed ordinal. Do not reset the ledger after rebasing, changing versions, or reopening a PR. CI currently performs validation with explicitly local test builds; it does not publish PR-labeled distribution artifacts or deploy.

## Surface Inventory

| Surface | Implementation |
| --- | --- |
| Release source | `release.json` |
| Allocator and timestamp | `scripts/build.mjs` |
| Console | `BUILD START`, `BUILD SUCCESS`, `BUILD FAILURE` lines |
| Distribution name | `dist/<full-build-id>/` |
| Manifest | Root and `public/build-info.json`, byte-identical |
| User interface | Persistent footer, read from `/build-info.json` |
| Current artifact report | Generated `BUILD_REPORT.md` inside each output |
| Local latest pointer | `.build/latest.json`, ignored by Git |
| CI summary | `GITHUB_STEP_SUMMARY` when provided |
| Contributor guidance | `AGENTS.md` and PR template |
| Consistency tests | `tests/build.test.mjs`; browser footer check |
| Deployed build record | Not applicable: no deployment is authorized or performed |

## Verification

`npm run check` checks unique concurrent local allocation, console/directory/manifest/report consistency, artifact reuse, and refusal to fabricate a PR ordinal. For the review artifact, compare its visible footer and actual PR head to the manifest. The review PR identifies the actual artifact used for browser QA. Do not commit generated timestamps back into the source merely to rebuild them.
