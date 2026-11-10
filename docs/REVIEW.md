# Prototype Review Guide

## Automated Checks

Run `npm run check` on Node.js 24 or later. The suite covers authorization failures, cross-student access attempts, hidden metadata, private notes, bulk award transactions, history and stale undo, rule validation, SQLite persistence, demo isolation, account provisioning, and immutable build identity. Review the exact test output for the current commit rather than treating this document as a pass certificate.

## Teacher Walkthrough

Use fictional records only. Sign in to the teacher demo, select a class and student, switch between radial/list views, inspect a badge, record a rank, and remove it. Confirm an optional teacher-only note never appears in student preview. Try a bulk award and undo it; then make a later change and confirm stale undo is rejected.

Create a badge with three ranks. Add it to a tree. Place it graphically, combine All Of and Any Of reveal conditions, and try a category count. Cancel a partially edited form and verify that nothing changed. Try a nonexistent reference, out-of-range rank, and a circular dependency. Unsafe changes should produce an understandable error.

Create a class and fictional student. Add a draft course mapping, including its source/version in the reference. Do not treat that association as verified standards coverage.

## Student Walkthrough

Sign out, then use each fictional student account in a separate browser context. Confirm that changing a URL or API identifier does not expose the other student's records. Earned badges and revealed silhouettes should be distinct. Unnamed silhouettes must not leak their name through the API. Hidden nodes and earning/reveal conditions must be absent from student responses.

Verify that teacher controls are unavailable, then try the teacher API directly; the server must reject it. Reload and restart to check persistence. Sign out and confirm the previous session no longer reads protected records.

## Interface Checks

- Review at 1440×900, a classroom laptop size, and a narrow phone width.
- Check keyboard focus, labeled fields, dialogs, Escape/Cancel, and repeated clicks.
- Zoom, pan, switch trees, change students, and return to list view. Do not rely on color alone for rank or state.
- Confirm no page errors, failed API requests, horizontal document overflow, or clipped primary controls.
- Read the full build ID in the footer and compare it with `build-info.json` and `BUILD_REPORT.md` in the same distribution directory.

## School Deployment Is a Separate Review

The fictional demo cannot establish that school accounts, HTTPS, retention, backups, or the actual host work. Follow the [Security and Operations](SECURITY.md) checklist before using real records. No public demo URL or school deployment is delivered by this repository change.
