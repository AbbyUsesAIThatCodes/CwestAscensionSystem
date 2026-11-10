# Initial Prototype Scope

## The Core Loop

Miller selects a student, records a badge rank, and reviews the student's private tree. His interpretation is the assessment layer. There are no required lesson records, rubrics, evidence uploads, or numerical grades.

The original request was for a graphical, expandable radial skill tracker for grades 7–12, including artistic, professional, and personal development. The application records dated recognition. An award date does not prove when learning occurred, and a missing badge does not prove inability.

## Implemented Direction

- Separate teacher and student sessions with authorization on the server.
- SQLite records, manual awards and removals, history, and reversible batch awards.
- Class organization and student selection.
- Editable badges with per-badge rank ladders, graphical tree placement, flexible reveal rules, and teacher preview.
- Distinct hidden, revealed silhouette, and earned states.
- A teacher-only editable course mapping structure. Associations are local draft mappings, not verified Ohio competency coverage.

Review the README and test report for actual verification and remaining limitations. A repository prototype is not a completed school deployment.

## Reversible Working Defaults

These are implementation choices for review, not decisions attributed to Miller:

- A small fictional starter catalog demonstrates the controls rather than claiming a complete or approved curriculum.
- The Power of Yet uses three configurable ranks. Other skills can use longer ladders.
- Visibility is separate from attainment. Removing a prerequisite never deletes downstream awards.
- Node category prerequisites count distinct other badges, excluding the node's own badge. Numeric minimum ranks are local ordinal positions within each badge's configurable ladder, not a universal measure of ability. Configure cross-category thresholds deliberately.
- Teacher hide overrides control presentation; retained earned records remain in the teacher's history. Removing a placement or assigning it a different badge clears its old visibility overrides.
- A currently unnamed, unearned silhouette also suppresses its history in the student view. This conservative visibility default does not delete the teacher audit history.
- Explicit badge prerequisites must refer to active badges. Edit those tree rules before archiving a referenced badge. Category counts use active badges only; an archive that makes a category threshold impossible is rejected.
- Unsafe changes to rank ladders with historical records are rejected rather than silently relabeling prior awards. A deliberate rank migration editor is future work.
- Server-provisioned username/password accounts provide a testable initial authentication route. School Google sign-in is not configured or claimed.
- Release 0.1.0 denotes a development prototype. No release codename has been chosen.

## Explicitly Outside This Version

No gradebook sync, grading, AI assessment, student evidence queue, peer verification, student-created skills, career trajectory explorer, employment certification, or public leaderboard. No automatic roster import, Google Classroom API integration, or school Google OAuth setup.

Google Classroom may distribute an application link once a real deployment is approved. The link does not authenticate a student or enforce access by itself.

## Ohio Course Layer

The supplied current course is **340110 Introduction to Media Arts**. The other identified courses are **340350 Social Media Communications**, **340320 Digital Print Design**, **340325 Digital Media Art**, **340340 Advertising & Communication**, **340120 Digital Image Editing**, and **340145 Video Production**. Two other potential courses remain unspecified and are not guessed.

Course titles were supplied in the prior project discussion. Detailed current competencies must be reviewed with Miller and the applicable Ohio source version. Neither the fictional seed nor a course association establishes curricular alignment.

## Design References

The interface takes its direction from the supplied CWEST rank posters and Skill Universe graphic: dark charcoal, red program accents, double-hexagon emblems, gold-to-purple progression, and a quieter teacher workspace. Source phone screenshots and the private conversation are not included in this public repository. Clean vector symbols are original interface assets, not a claim of final school-brand approval.
