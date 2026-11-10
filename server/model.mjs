import { randomUUID } from "node:crypto";
export const courses = [
  "340110",
  "340350",
  "340320",
  "340325",
  "340340",
  "340120",
  "340145",
];
export const icons = [
  "spark",
  "code",
  "palette",
  "camera",
  "film",
  "audio",
  "globe",
  "shield",
  "star",
  "rocket",
  "pen",
  "layers",
];
export function emptyModel() {
  return {
    classes: [],
    students: [],
    badges: [],
    trees: [],
    awards: [],
    overrides: [],
    history: [],
    mappings: [],
  };
}
export function demoModel() {
  const m = emptyModel();
  m.classes = [{ id: "class-1", name: "Digital Studio", courseCode: "340110" }];
  m.students = [
    { id: "student-1", name: "Alex Example", classIds: ["class-1"] },
    { id: "student-2", name: "Sam Sample", classIds: ["class-1"] },
    { id: "student-3", name: "Jordan Demo", classIds: ["class-1"] },
  ];
  m.badges = [
    ["design", "Composition", "Visual Foundations", "palette"],
    ["code", "Line", "Visual Foundations", "pen"],
    ["story", "Storytelling", "Communication", "film"],
    ["studio", "Studio Stewardship", "Studio Habits", "star"],
    ["web", "Shape", "Visual Foundations", "layers"],
    ["capstone", "Color Theory", "Visual Foundations", "palette"],
    ["yet", "Power of Yet", "Studio Habits", "spark"],
    ["thumbnailing", "Thumbnailing", "Visual Foundations", "pen"],
    ["typography", "Typography", "Communication", "layers"],
    ["collaboration", "Collaboration", "Studio Habits", "shield"],
    ["leadership", "Leadership", "Studio Habits", "star"],
  ].map(([id, name, category, icon]) => ({
    id,
    name,
    category,
    icon,
    description: `Explore and grow in ${name.toLowerCase()}. Ranks are awarded by your teacher.`,
    ranks:
      id === "yet"
        ? ["Beginning", "Developing", "Consistent"]
        : ["Explorer", "Practitioner", "Creator", "Mentor"],
    archived: false,
  }));
  m.trees = [
    {
      id: "tree-1",
      name: "Digital Studio",
      description: "Every creative journey starts with a spark.",
      rule: null,
      nodes: m.badges.slice(0, 6).map((b, i) => ({
        id: "node-" + b.id,
        badgeId: b.id,
        x: Math.round(350 + 200 * Math.cos((i * Math.PI) / 3 - Math.PI / 2)),
        y: Math.round(270 + 200 * Math.sin((i * Math.PI) / 3 - Math.PI / 2)),
        showName: true,
        rule:
          i === 5
            ? {
                type: "all",
                rules: [
                  { type: "badge", badgeId: "design", minRank: 2 },
                  {
                    type: "category",
                    category: "Visual Foundations",
                    count: 1,
                    minRank: 1,
                  },
                ],
              }
            : null,
      })),
    },
  ];
  m.awards = [
    {
      studentId: "student-1",
      badgeId: "design",
      rank: 2,
      publicNote: "Thoughtful use of contrast and hierarchy.",
      privateNote: "Fictional teacher-only example note.",
      version: 1,
    },
    {
      studentId: "student-1",
      badgeId: "code",
      rank: 1,
      publicNote: "A strong first step.",
      privateNote: "",
      version: 1,
    },
    {
      studentId: "student-2",
      badgeId: "story",
      rank: 1,
      publicNote: "",
      privateNote: "",
      version: 1,
    },
  ];
  return m;
}
export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
const text = (v, max = 200) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
export function evaluate(rule, m, studentId, targetBadgeId = null) {
  if (!rule) return true;
  if (rule.type === "all")
    return rule.rules.every((r) => evaluate(r, m, studentId, targetBadgeId));
  if (rule.type === "any")
    return rule.rules.some((r) => evaluate(r, m, studentId, targetBadgeId));
  if (rule.type === "badge")
    return m.awards.some(
      (a) =>
        a.studentId === studentId &&
        a.badgeId === rule.badgeId &&
        a.rank >= rule.minRank,
    );
  if (rule.type === "category")
    return (
      m.badges.filter(
        (b) =>
          b.id !== targetBadgeId &&
          !b.archived &&
          b.category === rule.category &&
          m.awards.some(
            (a) =>
              a.studentId === studentId &&
              a.badgeId === b.id &&
              a.rank >= rule.minRank,
          ),
      ).length >= rule.count
    );
  return false;
}
function validateRule(r, m, depth = 0) {
  if (r == null) return;
  if (depth > 8) fail("Prerequisite nesting cannot exceed 8 levels.");
  if (!r || typeof r !== "object") fail("Invalid prerequisite.");
  if (["all", "any"].includes(r.type)) {
    if (!Array.isArray(r.rules) || r.rules.length < 1 || r.rules.length > 20)
      fail("Groups need 1–20 rules.");
    r.rules.forEach((c) => validateRule(c, m, depth + 1));
  } else if (r.type === "badge") {
    const b = m.badges.find((b) => b.id === r.badgeId);
    if (b?.archived)
      fail("Reveal rules cannot require archived badges. Edit the tree rules before archiving this badge, or choose an active prerequisite.");
    if (
      !b ||
      !Number.isInteger(r.minRank) ||
      r.minRank < 1 ||
      r.minRank > b.ranks.length
    )
      fail("Badge prerequisite references an invalid badge or rank.");
  } else if (r.type === "category") {
    if (
      !m.badges.some((b) => b.category === r.category) ||
      !Number.isInteger(r.count) ||
      r.count < 1 ||
      r.count > 100 ||
      !Number.isInteger(r.minRank) ||
      r.minRank < 1 ||
      r.minRank > 20
    )
      fail("Invalid category prerequisite.");
    if (
      !m.badges.some(
        (b) => b.category === r.category && b.ranks.length >= r.minRank,
      )
    )
      fail("Category rank is out of bounds.");
    if (
      m.badges.filter(
        (b) =>
          !b.archived &&
          b.category === r.category &&
          b.ranks.length >= r.minRank,
      ).length < r.count
    )
      fail("Category count exceeds eligible distinct badges.");
  } else fail("Unknown prerequisite type.");
}
// Determine whether a reveal rule has a non-circular route from known badges.
// ANY alternatives and category thresholds are evaluated, not flattened to edges.
function canReach(rule, model, available, target) {
  if (!rule) return true;
  if (rule.type === "all")
    return rule.rules.every((r) => canReach(r, model, available, target));
  if (rule.type === "any")
    return rule.rules.some((r) => canReach(r, model, available, target));
  if (rule.type === "badge") return available.has(rule.badgeId);
  return (
    model.badges.filter(
      (b) =>
        b.id !== target &&
        !b.archived &&
        b.category === rule.category &&
        b.ranks.length >= rule.minRank &&
        available.has(b.id),
    ).length >= rule.count
  );
}
export function validateModel(m) {
  for (const b of m.badges) {
    if (
      !text(b.id) ||
      !text(b.name) ||
      !text(b.category) ||
      (!text(b.description || " ", 4000) && b.description !== "") ||
      !icons.includes(b.icon) ||
      !Array.isArray(b.ranks) ||
      b.ranks.length < 1 ||
      b.ranks.length > 20 ||
      b.ranks.some((r) => !text(r, 80)) ||
      new Set(b.ranks).size !== b.ranks.length
    )
      fail(
        "Badge needs a name, category, supported icon, and 1–20 unique rank names.",
      );
  }
  const placements = [];
  for (const t of m.trees) {
    if (!text(t.name) || !Array.isArray(t.nodes) || t.nodes.length > 100)
      fail("Invalid tree.");
    validateRule(t.rule, m);
    const ids = new Set();
    for (const n of t.nodes) {
      if (
        !text(n.id) ||
        ids.has(n.id) ||
        !m.badges.some((b) => b.id === n.badgeId) ||
        !Number.isFinite(n.x) ||
        !Number.isFinite(n.y) ||
        Math.abs(n.x) > 10000 ||
        Math.abs(n.y) > 10000 ||
        typeof n.showName !== "boolean"
      )
        fail("Invalid tree node.");
      ids.add(n.id);
      validateRule(n.rule, m);
      placements.push({
        badgeId: n.badgeId,
        rule: { type: "all", rules: [t.rule, n.rule] },
      });
    }
  }
  const targets = new Set(placements.map((p) => p.badgeId));
  const available = new Set(
    m.badges.filter((b) => !targets.has(b.id)).map((b) => b.id),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of placements) {
      if (
        !available.has(p.badgeId) &&
        canReach(p.rule, m, available, p.badgeId)
      ) {
        available.add(p.badgeId);
        changed = true;
      }
    }
  }
  if ([...targets].some((id) => !available.has(id)))
    fail(
      "Prerequisite cycle or impossible category count: every badge needs a non-circular reveal route. Category rules count other badges, not the node itself.",
    );
  for (const mapping of m.mappings)
    if (!m.badges.some((b) => b.id === mapping.badgeId))
      fail("Remove a badge's course mappings before deleting it.");
  for (const c of m.classes)
    if (!text(c.name) || (c.courseCode && !courses.includes(c.courseCode)))
      fail("Invalid class or Ohio course code.");
  for (const s of m.students)
    if (
      !text(s.name) ||
      !Array.isArray(s.classIds) ||
      s.classIds.some((id) => !m.classes.some((c) => c.id === id))
    )
      fail("Invalid student or class.");
}
export function studentView(m, id) {
  const student = m.students.find((s) => s.id === id);
  if (!student) fail("Student account is not assigned to a roster.", 403);
  const visible = new Set();
  const named = new Set();
  const earned = new Set(
    m.awards.filter((a) => a.studentId === id && a.rank > 0).map((a) => a.badgeId),
  );
  const trees = m.trees.flatMap((t) => {
    const nodes = t.nodes.flatMap((n) => {
      const o = m.overrides.find(
        (o) => o.studentId === id && o.treeId === t.id && o.nodeId === n.id,
      );
      const b = m.badges.find((b) => b.id === n.badgeId);
      const show =
        o?.visibility === "hide"
          ? false
          : o?.visibility === "show"
            ? true
            : evaluate(t.rule, m, id, n.badgeId) &&
              evaluate(n.rule, m, id, n.badgeId);
      if (!show || !b || b.archived) return [];
      visible.add(n.badgeId);
      if (n.showName) named.add(n.badgeId);
      return [
        { id: n.id, badgeId: n.badgeId, x: n.x, y: n.y, showName: n.showName },
      ];
    });
    return nodes.length
      ? [{ id: t.id, name: t.name, description: t.description || "", nodes }]
      : [];
  });
  return {
    student,
    classes: m.classes
      .filter((c) => student.classIds.includes(c.id))
      .map(({ id, name }) => ({ id, name })),
    trees,
    badges: m.badges
      .filter((b) => visible.has(b.id))
      .map((b) => {
        const earned = m.awards.some(
          (a) => a.studentId === id && a.badgeId === b.id && a.rank > 0,
        );
        if (!earned && !named.has(b.id))
          return {
            id: b.id,
            name: "Undiscovered Skill",
            category: "Undiscovered",
            icon: "shield",
            ranks: [],
            description: "",
            concealed: true,
          };
        return {
          id: b.id,
          name: b.name,
          category: b.category,
          icon: b.icon,
          ranks: b.ranks,
          description: earned ? b.description : "",
          concealed: false,
        };
      }),
    awards: m.awards
      .filter((a) => a.studentId === id && visible.has(a.badgeId) && a.rank > 0)
      .map(({ badgeId, rank, publicNote }) => ({ badgeId, rank, publicNote })),
    history: m.history
      .filter(
        (h) => h.studentId === id && visible.has(h.badgeId) &&
          (named.has(h.badgeId) || earned.has(h.badgeId)),
      )
      .map((h) => ({
        id: h.id,
        badgeId: h.badgeId,
        time: h.time,
        previousRank: h.previous.rank,
        rank: h.next.rank,
        publicNote: h.next.publicNote,
      })),
  };
}
export function mutate(m, kind, body, actor, deleteId) {
  let batchId;
  const collections = ["badges", "trees", "classes", "students"];
  if (collections.includes(kind)) {
    if (deleteId) {
      if (
        kind === "badges" &&
        (m.awards.some((a) => a.badgeId === deleteId) ||
          m.history.some((h) => h.badgeId === deleteId))
      )
        fail("Awarded badges must be archived rather than deleted.");
      if (
        kind === "students" &&
        (m.awards.some((a) => a.studentId === deleteId) ||
          m.history.some((h) => h.studentId === deleteId))
      )
        fail("Students with award history cannot be deleted.");
      m[kind] = m[kind].filter((x) => x.id !== deleteId);
      if (kind === "classes")
        m.students.forEach(
          (s) => (s.classIds = s.classIds.filter((id) => id !== deleteId)),
        );
      if (kind === "trees")
        m.overrides = m.overrides.filter((o) => o.treeId !== deleteId);
    } else {
      const id = body.id || randomUUID();
      if (!/^[\w-]{1,100}$/.test(id)) fail("Invalid identifier.");
      const old = m[kind].find((x) => x.id === id);
      let obj;
      if (kind === "badges") {
        obj = {
          id,
          name: body.name,
          description: body.description || "",
          category: body.category,
          icon: body.icon || "spark",
          ranks: body.ranks,
          archived: !!body.archived,
        };
        if (
          old &&
          (m.awards.some((a) => a.badgeId === id) ||
            m.history.some((h) => h.badgeId === id)) &&
          JSON.stringify(old.ranks) !== JSON.stringify(obj.ranks)
        )
          fail(
            "Rank ladder is in use. Create a new badge instead of changing its rank meanings.",
          );
      }
      if (kind === "trees") {
        obj = {
          id,
          name: body.name,
          description: body.description || "",
          rule: body.rule || null,
          nodes: body.nodes,
        };
        // Overrides apply to a particular placement of a particular badge.
        // Reusing a node ID must never reveal a different badge by accident.
        if (old && Array.isArray(obj.nodes))
          m.overrides = m.overrides.filter((o) =>
            o.treeId !== id || obj.nodes.some((n) =>
              n && n.id === o.nodeId && old.nodes.some((previous) =>
                previous.id === n.id && previous.badgeId === n.badgeId,
              ),
            ),
          );
      }
      if (kind === "classes")
        obj = { id, name: body.name, courseCode: body.courseCode || "340110" };
      if (kind === "students")
        obj = { id, name: body.name, classIds: body.classIds || [] };
      m[kind] = m[kind].filter((x) => x.id !== id);
      m[kind].push(obj);
    }
  } else if (kind === "awards") {
    const b = m.badges.find((b) => b.id === body.badgeId);
    if (
      !b ||
      b.archived ||
      !Number.isInteger(body.rank) ||
      body.rank < 0 ||
      body.rank > b.ranks.length
    )
      fail("Invalid award rank or archived badge.");
    if (
      !Array.isArray(body.studentIds) ||
      body.studentIds.length < 1 ||
      body.studentIds.length > 500 ||
      body.studentIds.some((id) => !m.students.some((s) => s.id === id))
    )
      fail("Select valid students.");
    if (
      [body.publicNote, body.privateNote].some(
        (v) => v != null && (typeof v !== "string" || v.length > 4000),
      )
    )
      fail("Notes must be at most 4000 characters.");
    batchId = randomUUID();
    for (const id of new Set(body.studentIds)) {
      const previous = m.awards.find(
        (a) => a.studentId === id && a.badgeId === b.id,
      ) || {
        studentId: id,
        badgeId: b.id,
        rank: 0,
        publicNote: "",
        privateNote: "",
        version: 0,
      };
      const next = {
        ...previous,
        rank: body.rank,
        publicNote: body.publicNote ?? previous.publicNote,
        privateNote: body.privateNote ?? previous.privateNote,
        version: previous.version + 1,
      };
      m.awards = m.awards.filter(
        (a) => !(a.studentId === id && a.badgeId === b.id),
      );
      m.awards.push(next);
      m.history.push({
        id: randomUUID(),
        batchId,
        studentId: id,
        badgeId: b.id,
        actor: actor.name,
        actorId: actor.id,
        time: new Date().toISOString(),
        previous,
        next,
      });
    }
  } else if (kind === "undo") {
    const rows = m.history.filter((h) => h.batchId === body.batchId);
    if (!rows.length || rows.some((h) => h.undoneBy))
      fail("Batch cannot be undone.", 409);
    for (const h of rows) {
      const current = m.awards.find(
        (a) => a.studentId === h.studentId && a.badgeId === h.badgeId,
      );
      if (!current || current.version !== h.next.version)
        fail(
          "Later changes exist. Undo is stale; no awards were changed.",
          409,
        );
    }
    batchId = randomUUID();
    for (const h of rows) {
      const next = { ...h.previous, version: h.next.version + 1 };
      m.awards = m.awards.filter(
        (a) => !(a.studentId === h.studentId && a.badgeId === h.badgeId),
      );
      m.awards.push(next);
      h.undoneBy = batchId;
      m.history.push({
        id: randomUUID(),
        batchId,
        studentId: h.studentId,
        badgeId: h.badgeId,
        actor: actor.name,
        actorId: actor.id,
        time: new Date().toISOString(),
        previous: h.next,
        next,
        undoOf: body.batchId,
      });
    }
  } else if (kind === "overrides") {
    if (
      !m.students.some((s) => s.id === body.studentId) ||
      !m.trees.some(
        (t) =>
          t.id === body.treeId && t.nodes.some((n) => n.id === body.nodeId),
      ) ||
      !["auto", "show", "hide"].includes(body.visibility)
    )
      fail("Invalid visibility override.");
    m.overrides = m.overrides.filter(
      (o) =>
        !(
          o.studentId === body.studentId &&
          o.treeId === body.treeId &&
          o.nodeId === body.nodeId
        ),
    );
    if (body.visibility !== "auto")
      m.overrides.push({
        studentId: body.studentId,
        treeId: body.treeId,
        nodeId: body.nodeId,
        visibility: body.visibility,
      });
  } else if (kind === "mappings") {
    if (!Array.isArray(body.mappings) || body.mappings.length > 1000)
      fail("Invalid mappings.");
    m.mappings = body.mappings.map((v) => {
      if (
        !courses.includes(v.courseCode) ||
        !m.badges.some((b) => b.id === v.badgeId) ||
        typeof (v.reference || "") !== "string" ||
        (v.reference || "").length > 1000 ||
        typeof (v.notes || "") !== "string" ||
        (v.notes || "").length > 4000
      )
        fail("Invalid course mapping.");
      return {
        courseCode: v.courseCode,
        badgeId: v.badgeId,
        reference: v.reference || "",
        notes: v.notes || "",
      };
    });
  } else fail("Not found.", 404);
  validateModel(m);
  return batchId;
}
