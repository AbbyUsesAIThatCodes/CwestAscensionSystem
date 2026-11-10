import { rankTone, rankNumeral } from "./rank-display.js";

const $ = (s) => document.querySelector(s),
  esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let session = {},
  data = {},
  preview = null,
  view = "tree",
  studentId = "",
  treeId = "",
  badgeId = "",
  classId = "",
  search = "",
  listMode = false,
  zoom = 1,
  pan = { x: 0, y: 0 },
  build = null,
  busy = false;
const icons = {
  spark: "M0 -10 L3 -3 10 0 3 3 0 10 -3 3 -10 0 -3 -3 Z",
  code: "M-4 -7 -11 0 -4 7 M4 -7 11 0 4 7 M2 -10 -2 10",
  palette:
    "M0 -10 C-14 -10 -15 10 -2 10 C5 10 0 3 6 3 C15 3 12 -10 0 -10 M-5 -4 h.1 M1 -6 h.1 M6 -3 h.1",
  camera:
    "M-12 -7 H-5 L-3 -10 H4 L6 -7 H12 V9 H-12 Z M5 1 A5 5 0 1 0 -5 1 A5 5 0 1 0 5 1",
  film: "M-12 -9 H12 V9 H-12 Z M-7 -9 V9 M7 -9 V9 M-12 -3 H-7 M-12 3 H-7 M7 -3 H12 M7 3 H12",
  audio: "M-10 -3 V3 M-5 -8 V8 M0 -12 V12 M5 -7 V7 M10 -3 V3",
  globe:
    "M11 0 A11 11 0 1 0 -11 0 A11 11 0 1 0 11 0 M-11 0 H11 M0 -11 C-8 -4 -8 4 0 11 C8 4 8 -4 0 -11",
  shield: "M0 -12 10 -8 V1 Q9 8 0 12 Q-9 8 -10 1 V-8 Z M-4 0 -1 4 6 -4",
  star: "M0 -12 3 -4 12 -3 5 3 7 12 0 7 -7 12 -5 3 -12 -3 -3 -4 Z",
  rocket:
    "M-3 5 Q-10 -5 8 -12 Q14 3 3 7 Z M-4 2 -10 5 -9 -2 M3 6 1 12 8 9 M-6 7 -10 11",
  pen: "M-9 10 -7 3 6 -10 11 -5 -2 8 Z M-7 3 -2 8 M4 -8 9 -3",
  layers: "M0 -11 13 -4 0 3 -13 -4 Z M-12 2 0 9 12 2 M-12 8 0 15 12 8",
};
function emblem(icon = "spark", earned = true, tone = "#bc8bff", number = "") {
  return `<svg class="badge-icon" viewBox="-35 -38 70 76" aria-hidden="true"><defs><linearGradient id="metal"><stop stop-color="#ddc2f7"/><stop offset=".5" stop-color="#5e496e"/><stop offset="1" stop-color="#a978d6"/></linearGradient></defs><polygon points="0,-35 30,-18 30,18 0,35 -30,18 -30,-18" fill="#18121f" stroke="${earned ? tone : "#655c6e"}" stroke-width="2"/><polygon points="0,-29 25,-14.5 25,14.5 0,29 -25,14.5 -25,-14.5" fill="#19131f" stroke="${earned ? tone : "#39323f"}"/><path d="${earned ? icons[icon] || icons.spark : icons.spark}" fill="none" stroke="${earned ? tone : "#453d4f"}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>${number ? `<text x="0" y="25" text-anchor="middle" fill="${tone}" font-size="7" font-weight="700">${number}</text>` : ""}</svg>`;
}
function resetSessionView() {
  preview = null;
  data = {};
  view = "tree";
  studentId = "";
  treeId = "";
  badgeId = "";
  classId = "";
  search = "";
  listMode = false;
  zoom = 1;
  pan = { x: 0, y: 0 };
}
const brand = () =>
  `<div class="brand"><div class="brand-symbol" aria-hidden="true">///</div><div><div class="brand-title">CWEST <span style="font-weight:400">ASCENSION</span></div><div class="brand-sub">NCH DIGITAL ARTS & DESIGN</div></div></div>`;
async function api(path, body, method = "POST") {
  const r = await fetch(path, {
    method: body === undefined ? "GET" : method,
    headers: {
      "Content-Type": "application/json",
      ...(session.csrf ? { "X-CSRF-Token": session.csrf } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let j;
  try {
    j = await r.json();
  } catch {
    throw Error(
      "The studio could not read the server response. Please try again.",
    );
  }
  if (!r.ok) {
    if (r.status === 401 && session.user) {
      session = { user: null, demo: session.demo };
      resetSessionView();
      if ($("#dialog").open) closeDialog();
      render();
    }
    throw Error(j.error || "The request could not be completed.");
  }
  return j;
}
function toast(s) {
  $("#toast").textContent = s;
  $("#toast").style.display = "block";
  setTimeout(() => ($("#toast").style.display = "none"), 4500);
}
const teacher = () => session.user?.role === "teacher";
const model = () => preview || data;
const student = () =>
  teacher() && !preview
    ? data.students?.find((x) => x.id === studentId)
    : model().student;
const awards = () => model().awards || [];
const award = (b) =>
  awards().find(
    (a) =>
      a.badgeId === b && (!teacher() || preview || a.studentId === studentId),
  );
const rank = (b) => award(b)?.rank || 0;
const currentTree = () =>
  model().trees?.find((t) => t.id === treeId) || model().trees?.[0];
function opts(items, val, label = "name") {
  return items
    .map(
      (x) =>
        `<option value="${esc(x.id)}" ${x.id === val ? "selected" : ""}>${esc(x[label])}</option>`,
    )
    .join("");
}
function footer() {
  return `<div class="build">Prototype · ${session.demo ? "Fictional Demo Data" : "Local Account Mode · No Real Student Data"} · Not Connected to Grades<br>${esc(build?.id || build?.fullId || build?.full_id || build?.buildId || "Live Development · Build Identity Not Generated")}</div>`;
}
async function init() {
  try {
    session = await api("/api/session");
    try {
      build = await api("/build-info.json");
    } catch {}
    if (session.user) await refresh();
    else render();
  } catch (e) {
    $("#app").innerHTML =
      `<main><h1>Studio Unavailable</h1><p>${esc(e.message)}</p><button data-reload>Try Again</button></main>`;
  }
}
async function refresh() {
  data = await api(teacher() ? "/api/teacher" : "/api/student");
  if (teacher() && !data.students.some((s) => s.id === studentId))
    studentId = data.students[0]?.id || "";
  render();
}
function login() {
  return `<div class="login"><section class="login-art">${brand()}${emblem("spark")}<div class="eyebrow gold">From Potential to Mastery</div><h1 style="margin-top:18px">Every Skill.<br>A New Ascent.</h1><p>A clear view of creative growth.<br>Teacher-guided. Individually earned.</p></section><main class="login-panel" id="main"><span class="pill" style="align-self:start;margin-bottom:25px">WORKING PROTOTYPE</span><h2>Enter the Studio</h2><p>Explore a fictional class, or sign in to your local account.</p>${session.demo ? `<div class="demo-buttons"><button class="primary" data-demo="teacher">Open Miller’s Demo Studio <span aria-hidden="true">↗</span></button><div class="two-col" style="gap:9px"><button data-demo="student-1">Student A</button><button data-demo="student-2">Student B</button></div></div><p class="subtle" style="margin-top:12px">Local demo only. Student sessions see their own progress, never teacher controls.</p><div class="divider"></div>` : ""}<form id="login-form"><label class="field">Username<input name="username" autocomplete="username" required></label><label class="field">Password<input name="password" type="password" autocomplete="current-password" required></label><div class="form-error"></div><button type="submit">Sign In</button></form><div class="login-footer subtle">Google sign-in and school hosting are not configured.<br>No real student information belongs in this prototype.</div>${footer()}</main></div>`;
}
function render() {
  if (session.user && !teacher() && !["tree", "history"].includes(view))
    view = "tree";
  if (!session.user) {
    $("#app").innerHTML = login();
    return;
  }
  const isT = teacher();
  $("#app").innerHTML =
    `<header class="app-header">${brand()}<div class="header-right"><span class="pill">${isT ? "TEACHER STUDIO" : "STUDENT STUDIO"}</span><span class="user-name muted">${esc(session.user.name)}</span><button class="quiet small" data-action="logout">Sign Out</button></div></header><div class="shell"><nav class="sidebar" aria-label="Main Navigation"><span class="eyebrow section-label">Your Studio</span>${(isT
      ? [
          ["tree", "Skill Universe"],
          ["students", "Class Overview"],
          ["badges", "Badge Library"],
          ["trees", "Tree Builder"],
          ["history", "Award History"],
          ["mappings", "Course References"],
          ["roster", "Classes & Students"],
        ]
      : [
          ["tree", "My Skill Universe"],
          ["history", "My Journey"],
        ]
    )
      .map(
        ([v, n]) =>
          `<button data-view="${v}" class="${view === v ? "active" : ""}">${n}</button>`,
      )
      .join(
        "",
      )}<div class="sidebar-note"><b>Growth, Not Grades</b><br>Ranks reflect a teacher’s judgment. They do not calculate a grade or compare students.</div></nav><main id="main">${preview ? `<div class="preview-banner"><span>Private Student Preview · ${esc(preview.student?.name)} · Read-only</span><button class="small" data-action="end-preview">Return to Teacher</button></div>` : ""}${view === "tree" ? treeView() : view === "badges" ? badgesView() : view === "trees" ? treesView() : view === "students" ? studentsView() : view === "history" ? historyView() : view === "mappings" ? mappingsView() : rosterView()}${footer()}</main></div>`;
  wireMap();
}
function heading(title, desc, action = "") {
  return `<div class="page-heading"><div><div class="eyebrow gold" style="margin-bottom:10px">${teacher() ? "Teacher-Guided Growth" : "Your Creative Practice"}</div><h1>${title}</h1><p>${desc}</p></div>${action}</div>`;
}
function treeView() {
  const m = model(),
    t = currentTree(),
    s = student(),
    all = m.badges || [],
    nodes = t?.nodes || [];
  let badges = all.filter(
    (b) =>
      nodes.some((n) => n.badgeId === b.id) &&
      (!search || b.name.toLowerCase().includes(search.toLowerCase())),
  );
  if (!badges.some((b) => b.id === badgeId)) badgeId = badges[0]?.id || "";
  const b = badges.find((b) => b.id === badgeId),
    earned = badges.filter((b) => rank(b.id) > 0).length;
  return `${heading(preview ? "Their View of the Ascent" : teacher() ? "The Skill Universe" : "Your Skill Universe", teacher() && !preview ? "See the whole path. Recognize the next step." : "Every earned badge tells a part of your creative story.", teacher() && !preview ? '<button class="primary" data-action="award">＋ Award a Rank</button>' : "")}<div class="toolbar">${
    teacher() && !preview
      ? `<label>Class <select id="class-filter"><option value="">All Classes</option>${opts(data.classes, classId)}</select></label><label>Student <select id="student-select">${opts(
          data.students.filter((s) => !classId || s.classIds.includes(classId)),
          studentId,
        )}</select></label><button class="small quiet" data-action="preview">Preview Student View</button>`
      : `<span class="pill">${esc(s?.name || "Your Studio")}</span>`
  }<label>Tree <select id="tree-select">${opts(m.trees || [], t?.id)}</select></label></div><div class="stat-strip"><div class="stat"><strong>${earned}<span style="font-size:13px"> / ${badges.length}</span></strong><span>${teacher() && !preview ? "Badges Earned by This Student" : "Visible Badges Earned"}</span></div><div class="stat"><strong>${badges.filter((b) => b.ranks.length > 0 && rank(b.id) === b.ranks.length).length}</strong><span>Top Ranks Recognized</span></div><div class="stat"><strong>${new Set(badges.filter((b) => rank(b.id) > 0).map((b) => b.category)).size}</strong><span>Creative Disciplines Explored</span></div></div><div class="workspace"><section class="panel map-panel"><div class="panel-top"><div><h3>${esc(t?.name || "No Visible Trees")}</h3><span class="subtle">${teacher() && !preview ? "Teacher view includes all placed badges" : "Only the paths visible to you appear here"}</span></div><div class="toolbar"><input id="badge-search" aria-label="Find a badge" placeholder="Find a badge…" value="${esc(search)}" style="width:135px"><button class="small" data-action="toggle-list">${listMode ? "Map View" : "List View"}</button></div></div>${listMode ? `<div>${badges.map((b) => `<div class="list-row">${emblem(b.icon, rank(b.id) > 0, rankTone(b, rank(b.id)), rankNumeral(rank(b.id), b))}<div class="grow"><h3>${esc(b.name)}</h3><p>${esc(rank(b.id) ? b.ranks[rank(b.id) - 1] : "Unexplored Potential")}</p></div><button data-select-badge="${esc(b.id)}">Details</button></div>`).join("") || '<div class="empty">No badges match this view.</div>'}</div>` : `<div class="map-viewport" aria-label="Skill Tree. Drag to pan; use buttons to zoom.">${mapSvg(t, badges)}<div class="map-caption">DRAG TO EXPLORE · SELECT A BADGE</div><div class="map-controls"><button data-action="zoom-out" aria-label="Zoom out">−</button><button data-action="zoom-reset" aria-label="Reset map">⌖</button><button data-action="zoom-in" aria-label="Zoom in">＋</button></div></div>`}<div class="legend"><span><i class="dot"></i>Earned</span><span><i class="dot dormant"></i>Unexplored</span><span>Ranks are manually awarded</span></div></section><aside class="panel">${b ? detail(b, t) : '<div class="empty">Choose a badge to explore.</div>'}</aside></div>`;
}
function mapSvg(t, badges) {
  const nodes = (t?.nodes || []).filter((n) =>
    badges.some((b) => b.id === n.badgeId),
  );
  return `<svg class="tree-svg" viewBox="0 0 700 540" role="group" aria-label="Radial Skill Map"><g id="map-world" transform="translate(${pan.x} ${pan.y}) translate(350 270) scale(${zoom}) translate(-350 -270)"><circle class="orbit" cx="350" cy="270" r="110"/><circle class="orbit" cx="350" cy="270" r="205"/>${nodes.map((n) => `<path class="link" d="M350 270 L${Number(n.x)} ${Number(n.y)}"/>`).join("")}<g transform="translate(350 270)"><path d="M0 -28 L7 -8 28 0 7 8 0 28 -7 8 -28 0 -7 -8Z" fill="#a371d8" opacity=".4"/><text y="48" text-anchor="middle" fill="#8f7a9f" font-size="8" letter-spacing="3">ASCEND</text></g>${nodes
    .map((n) => {
      const b = badges.find((b) => b.id === n.badgeId),
        r = rank(b.id);
      return `<g class="node ${r ? "earned" : ""} ${badgeId === b.id ? "selected" : ""}" transform="translate(${Number(n.x)} ${Number(n.y)}) scale(3)" data-select-badge="${esc(b.id)}" role="button" tabindex="0" aria-label="${esc(b.name)}, ${esc(r ? b.ranks[r - 1] : "unearned")}"><polygon class="outer" points="0,-12 10.4,-6 10.4,6 0,12 -10.4,6 -10.4,-6" fill="#1b1522" stroke="${r ? rankTone(b, r) : "#5b5267"}"/><polygon points="0,-9.6 8.3,-4.8 8.3,4.8 0,9.6 -8.3,4.8 -8.3,-4.8" fill="#1c1624" stroke="${r ? rankTone(b, r) : "#302a38"}" stroke-width=".4"/><path transform="scale(.5)" d="${r ? icons[b.icon] || icons.spark : icons.spark}" fill="none" stroke="${r ? rankTone(b, r) : "#4d4259"}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>${r ? `<text y="9" style="font-size:2.5px;fill:${rankTone(b, r)}">${rankNumeral(r, b)}</text>` : ""}${n.showName !== false || r ? `<text y="17">${esc(b.name)}</text>` : ""}<text class="rank-label" y="21.7">${esc(r ? b.ranks[r - 1] : "UNEXPLORED")}</text></g>`;
    })
    .join("")}</g></svg>`;
}
function detail(b, t) {
  let r = rank(b.id),
    a = award(b.id);
  return `<div class="detail"><div class="eyebrow">${r ? "Recognized Growth" : "Unexplored Potential"}</div>${emblem(b.icon, !!r, rankTone(b, r), rankNumeral(r, b))}<h2>${esc(b.name)}</h2><div class="category">${esc(b.category)}</div><p>${esc(b.description)}</p><div class="rank-track">${b.ranks.map((_, i) => `<span class="${i < r ? "filled" : ""}"></span>`).join("")}</div><div class="subtle">${b.concealed ? "A Future Discovery" : `${r ? esc(b.ranks[r - 1]) : "Not Yet Awarded"} · ${r} / ${b.ranks.length}`}</div><p class="help" style="margin-top:12px">${b.ranks.map((n, i) => `${i + 1}. ${esc(n)}`).join(" · ")}</p>${a?.publicNote ? `<div class="detail-note"><b>Teacher’s Note</b><br>${esc(a.publicNote)}</div>` : ""}${teacher() && !preview ? `<div style="margin-top:23px"><button class="primary" data-action="award" data-badge="${esc(b.id)}">${r ? "Update Rank" : "Award a Rank"}</button><button class="quiet small" data-action="visibility" style="margin-top:10px">Student Visibility Settings</button></div>${a?.privateNote ? `<div class="detail-note"><b>Private Teacher Note</b><br>${esc(a.privateNote)}</div>` : ""}` : '<p class="subtle" style="margin-top:20px">Your teacher recognizes growth and updates your ranks.</p>'}</div>`;
}
function badgesView() {
  return `${heading("Badge Library", "Define skills and the ranks that matter to your teaching.", '<button class="primary" data-action="edit-badge">＋ Create Badge</button>')}<div class="cards">${data.badges.map((b) => `<article class="panel badge-card">${emblem(b.icon, !b.archived)}<span class="eyebrow gold">${esc(b.category)}</span><h3>${esc(b.name)} ${b.archived ? '<span class="pill">Archived</span>' : ""}</h3><p>${esc(b.description)}</p><span class="subtle">${b.ranks.length} configurable ranks</span><button data-action="edit-badge" data-id="${esc(b.id)}">Edit Badge</button></article>`).join("")}</div>`;
}
function treesView() {
  return `${heading("Tree Builder", "Compose visible paths without changing earned records.", '<button class="primary" data-action="edit-tree">＋ Create Tree</button>')}<div class="cards">${data.trees.map((t) => `<article class="panel badge-card"><span class="eyebrow gold">${t.nodes.length} Skill Placements</span><h2>${esc(t.name)}</h2><p>${esc(t.description)}</p><p>${t.rule ? "Tree-level visibility rule configured." : "Tree visible by default."}</p><button data-action="edit-tree" data-id="${esc(t.id)}">Edit Layout & Visibility</button></article>`).join("")}</div>`;
}
function studentsView() {
  let ss = data.students.filter(
    (s) => !classId || s.classIds.includes(classId),
  );
  return `${heading("Class Overview", "A conversation starter for pacing, not a score or ranking.")}<div class="toolbar" style="margin-bottom:18px"><label>Class <select id="class-filter"><option value="">All Classes</option>${opts(data.classes, classId)}</select></label><button class="primary" data-action="award">Award Multiple Students</button></div><div class="panel table-wrap"><table><thead><tr><th>Student</th><th>Earned Badges</th><th>Disciplines Explored</th><th>Open Studio</th></tr></thead><tbody>${ss
    .map((s) => {
      let aa = data.awards.filter((a) => a.studentId === s.id && a.rank > 0);
      return `<tr><td>${esc(s.name)}</td><td>${aa.length}</td><td>${new Set(aa.map((a) => data.badges.find((b) => b.id === a.badgeId)?.category)).size}</td><td><button class="small" data-student="${esc(s.id)}">View Growth ↗</button></td></tr>`;
    })
    .join(
      "",
    )}</tbody></table></div><p class="help" style="margin-top:16px">These counts describe recorded recognition only. They cannot establish whether a student is struggling or whether instruction is moving too quickly. Use your observations and student conversations alongside the map.</p>`;
}
function historyView() {
  const hist = model().history || [];
  return `${heading(teacher() ? "Award History" : "My Journey", teacher() ? "Review changes and undo an entire award batch." : "Recognition of your creative growth, one step at a time.")}<section class="panel">${
    hist
      .slice()
      .reverse()
      .map((h) => {
        let b = model().badges.find((b) => b.id === h.badgeId);
        let r = h.next?.rank ?? h.rank ?? 0;
        return `<div class="list-row">${emblem(b?.icon, !!r, rankTone(b, r), rankNumeral(r, b))}<div class="grow"><h3>${esc(b?.name || "Badge")} · ${esc(r ? b?.ranks[r - 1] || "Rank " + r : "Rank Removed")}</h3><p>${teacher() ? esc(data.students.find((s) => s.id === h.studentId)?.name || "Student") + " · " : ""}${esc(new Date(h.time).toLocaleString())}${h.undoneBy ? " · Undone" : ""}${h.undoOf ? " · Undo Record" : ""}</p>${h.publicNote ? `<p>${esc(h.publicNote)}</p>` : ""}</div>${teacher() && !h.undoneBy && !h.undoOf ? `<button class="small" data-undo="${esc(h.batchId)}">Undo Batch</button>` : ""}</div>`;
      })
      .join("") ||
    '<div class="empty">Your journey starts with the first recognized skill.</div>'
  }</section>`;
}
function mappingsView() {
  return `${heading("Course References", "Draft teaching references only. No official alignment has been verified.", '<button class="primary" data-action="edit-mappings">Edit References</button>')}<div class="panel table-wrap"><table><thead><tr><th>Course Code</th><th>Badge / Competency</th><th>Source & Version</th><th>Notes</th></tr></thead><tbody>${data.mappings.map((m) => `<tr><td>${esc(m.courseCode)}</td><td>${esc(data.badges.find((b) => b.id === m.badgeId)?.name || m.badgeId)}</td><td>${esc(m.reference)}</td><td>${esc(m.notes)}</td></tr>`).join("")}</tbody></table></div><p class="help" style="margin-top:15px">Teacher-only planning material. Verify each source and course version before using it as an official competency mapping.</p>`;
}
function rosterView() {
  return `${heading("Classes & Students", "Manage the fictional studio roster. Sign-in accounts are managed separately.")}<div class="two-col"><section class="panel"><div class="panel-top"><h2>Classes</h2><button class="small" data-action="edit-class">＋ Add Class</button></div>${data.classes.map((c) => `<div class="list-row"><div class="grow"><h3>${esc(c.name)}</h3><p>${esc(c.courseCode)}</p></div><button class="small" data-action="edit-class" data-id="${esc(c.id)}">Edit</button></div>`).join("")}</section><section class="panel"><div class="panel-top"><h2>Students</h2><button class="small" data-action="edit-student">＋ Add Student</button></div>${data.students
    .map(
      (s) =>
        `<div class="list-row"><div class="grow"><h3>${esc(s.name)}</h3><p>${esc(
          s.classIds
            .map((id) => data.classes.find((c) => c.id === id)?.name)
            .filter(Boolean)
            .join(", "),
        )}</p></div><button class="small" data-action="edit-student" data-id="${esc(s.id)}">Edit</button></div>`,
    )
    .join("")}</section></div>`;
}
let dialogSave = null,
  editing = null,
  returnFocus = null,
  placementIndex = 0;
function openDialog(title, body, save, label = "Save Changes") {
  returnFocus = document.activeElement;
  dialogSave = save;
  $("#dialog").innerHTML =
    `<div class="dialog-head"><h2>${title}</h2><button class="quiet small" data-close aria-label="Close dialog">✕</button></div><form id="dialog-form" class="dialog-body">${body}<div class="form-error" role="alert"></div><div class="dialog-actions"><button type="button" data-close>Cancel</button><button class="primary" type="submit">${label}</button></div></form>`;
  $("#dialog").showModal();
}
function closeDialog() {
  $("#dialog").close();
  returnFocus?.focus();
}
const field = (name, label, value = "", type = "text", extra = "") =>
  `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
async function mutate(path, payload, method) {
  data = await api("/api/teacher/" + path, payload, method);
  preview = null;
  render();
}
function awardDialog(id) {
  let b =
    data.badges.find((b) => b.id === (id || badgeId)) ||
    data.badges.find((b) => !b.archived);
  if (!b) return toast("Create a badge first.");
  openDialog(
    "Recognize Creative Growth",
    `<p class="help">Your judgment sets the rank. This does not create a grade.</p><label class="field">Badge<select name="badgeId" id="award-badge">${opts(
      data.badges.filter((x) => !x.archived),
      b.id,
    )}</select></label><label class="field">New Rank<select name="rank" id="award-rank">${rankOptions(b, rank(b.id))}</select></label><label class="field">Students</label><div class="toolbar" style="margin-bottom:10px"><button type="button" class="small" data-check-all>Select All in Class</button><button type="button" class="small" data-check-none>Clear Selection</button></div><div class="student-checks">${data.students
      .filter((s) => !classId || s.classIds.includes(classId))
      .map(
        (s) =>
          `<label class="check"><input type="checkbox" name="studentIds" value="${esc(s.id)}" ${s.id === studentId ? "checked" : ""}>${esc(s.name)}</label>`,
      )
      .join(
        "",
      )}</div><label class="field">Shared Note <span class="help">Visible to each selected student</span><textarea name="publicNote" maxlength="2000" placeholder="A moment of growth worth recognizing…"></textarea></label><label class="field">Private Teacher Note <span class="help">Never included in a student session</span><textarea name="privateNote" maxlength="2000"></textarea></label><p class="help">This replaces the selected students’ current rank and notes for this badge. Removing a rank preserves the audit history.</p>`,
    async (f) => {
      let ids = f.getAll("studentIds");
      if (!ids.length) throw Error("Select at least one student.");
      await mutate("awards", {
        badgeId: f.get("badgeId"),
        rank: Number(f.get("rank")),
        studentIds: ids,
        publicNote: f.get("publicNote"),
        privateNote: f.get("privateNote"),
      });
      toast("Recognition saved. You can undo this batch in Award History.");
    },
    "Save Recognition",
  );
}
function rankOptions(b, r) {
  return `<option value="0">Remove Rank / Not Earned</option>${b.ranks.map((n, i) => `<option value="${i + 1}" ${i + 1 === r ? "selected" : ""}>${i + 1} · ${esc(n)}</option>`).join("")}`;
}
function badgeDialog(id) {
  let b = data.badges.find((b) => b.id === id) || {
    name: "",
    category: "Creative Foundations",
    icon: "spark",
    description: "",
    ranks: ["Introduced", "Practitioner", "Mastery"],
  };
  openDialog(
    id ? "Edit Badge" : "Create Badge",
    `${field("name", "Badge Name", b.name, "text", 'required maxlength="100"')}${field("category", "Discipline / Category", b.category, "text", 'required maxlength="100"')}<label class="field">Skill Symbol<select name="icon">${Object.keys(
      icons,
    )
      .map((i) => `<option ${b.icon === i ? "selected" : ""}>${i}</option>`)
      .join(
        "",
      )}</select></label><label class="field">Description<textarea name="description" maxlength="2000">${esc(b.description)}</textarea></label><div class="toolbar"><span class="help">Rank Presets</span><button type="button" class="small" data-rank-preset="yet">Three-Step Growth</button><button type="button" class="small" data-rank-preset="ascension">Full Ascension</button></div><label class="field">Rank Names <span class="help">One per line, lowest to highest. Use 2–3 simple steps or a longer progression. Introduced is explicitly awarded; visibility alone never awards a rank.</span><textarea name="ranks" required>${esc(b.ranks.join("\n"))}</textarea></label><label class="check"><input type="checkbox" name="archived" ${b.archived ? "checked" : ""}>Archive This Badge</label><p class="help">Archiving keeps earned ranks and history. Rank changes that would reinterpret existing records are blocked by the server.</p>`,
    async (f) => {
      await mutate("badges", {
        ...b,
        name: f.get("name").trim(),
        category: f.get("category").trim(),
        icon: f.get("icon"),
        description: f.get("description"),
        ranks: f
          .get("ranks")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        archived: f.has("archived"),
      });
      toast("Badge saved.");
    },
  );
}
function visibilityDialog() {
  let t = currentTree(),
    n = t?.nodes.find((n) => n.badgeId === badgeId);
  if (!studentId || !n) return;
  let o = data.overrides.find(
    (o) => o.studentId === studentId && o.treeId === t.id && o.nodeId === n.id,
  );
  openDialog(
    "Student Visibility",
    `<p>Set visibility for <b>${esc(student()?.name)}</b> and <b>${esc(data.badges.find((b) => b.id === badgeId)?.name)}</b>.</p><label class="field">Visibility Override<select name="visibility"><option value="auto" ${!o || o.visibility === "auto" ? "selected" : ""}>Automatic · Follow Prerequisites</option><option value="show" ${o?.visibility === "show" ? "selected" : ""}>Show · Override Prerequisites</option><option value="hide" ${o?.visibility === "hide" ? "selected" : ""}>Hide · Keep Earned Record</option></select></label><p class="help">This changes only what this student can see. Earned ranks and teacher history stay intact. Use the private student preview to verify the resulting view.</p>`,
    async (f) => {
      await mutate("overrides", {
        studentId,
        treeId: t.id,
        nodeId: n.id,
        visibility: f.get("visibility"),
      });
      toast("Visibility updated.");
    },
  );
}
function simpleDialog(type, id) {
  let isStudent = type === "students",
    o = data[type].find((x) => x.id === id) || {
      name: "",
      ...(isStudent ? { classIds: [] } : { courseCode: "" }),
    };
  openDialog(
    `${id ? "Edit" : "Add"} ${isStudent ? "Student" : "Class"}`,
    `${field("name", "Name", o.name, "text", 'required maxlength="100"')}${isStudent ? `<label class="field">Classes</label><div class="student-checks">${data.classes.map((c) => `<label class="check"><input name="classIds" type="checkbox" value="${esc(c.id)}" ${o.classIds.includes(c.id) ? "checked" : ""}>${esc(c.name)}</label>`).join("")}</div><p class="help">This creates a roster entry, not a login account. No real student data should be entered into this demo.</p>` : field("courseCode", "Course Code", o.courseCode)}${id ? `<p class="help">Deletion is blocked when linked records must be preserved.</p><button type="button" class="danger small" data-delete="${type}" data-id="${esc(id)}">Delete ${isStudent ? "Student" : "Class"}</button>` : ""}`,
    async (f) => {
      await mutate(type, {
        ...o,
        name: f.get("name"),
        ...(isStudent
          ? { classIds: f.getAll("classIds") }
          : { courseCode: f.get("courseCode") }),
      });
      toast("Roster updated.");
    },
  );
}
function ruleHTML(rule, path) {
  const type = rule?.type || "none";
  return `<div class="rule" data-rule="${path}"><div class="toolbar"><select data-rule-type="${path}" aria-label="Rule type"><option value="none" ${type === "none" ? "selected" : ""}>Always Visible</option><option value="all" ${type === "all" ? "selected" : ""}>All Of These</option><option value="any" ${type === "any" ? "selected" : ""}>Any Of These</option><option value="badge" ${type === "badge" ? "selected" : ""}>Badge at Rank</option><option value="category" ${type === "category" ? "selected" : ""}>Number of Badges in Category</option></select>${type === "badge" ? `<select data-rule-field="${path}|badgeId" aria-label="Required badge">${opts(data.badges, rule.badgeId)}</select><label class="help">At Least Rank <input type="number" min="1" max="30" value="${rule.minRank || 1}" data-rule-field="${path}|minRank"></label>` : ""}${type === "category" ? `<select data-rule-field="${path}|category" aria-label="Required category">${[...new Set(data.badges.map((b) => b.category))].map((c) => `<option ${c === rule.category ? "selected" : ""}>${esc(c)}</option>`).join("")}</select><label class="help">Count <input type="number" min="1" max="100" value="${rule.count || 1}" data-rule-field="${path}|count"></label><label class="help">At Least Rank <input type="number" min="1" max="30" value="${rule.minRank || 1}" data-rule-field="${path}|minRank"></label>` : ""}${path.includes(".rules.") ? `<button type="button" class="small danger" data-rule-remove="${path}" aria-label="Remove condition">×</button>` : ""}</div>${["all", "any"].includes(type) ? `<div class="rule-children">${(rule.rules || []).map((r, i) => ruleHTML(r, path + ".rules." + i)).join("")}<button type="button" class="small" data-rule-add="${path}">＋ Add Condition</button></div>` : ""}</div>`;
}
function treeDialog(id) {
  placementIndex = 0;
  editing = structuredClone(
    data.trees.find((t) => t.id === id) || {
      name: "New Skill Tree",
      description: "",
      rule: null,
      nodes: [],
    },
  );
  openDialog(
    id ? "Edit Skill Tree" : "Create Skill Tree",
    treeForm(),
    async () => {
      readTreeBasic();
      await mutate("trees", editing);
      toast("Tree saved. Earned records were preserved.");
    },
  );
}
function treeForm() {
  return `${field("name", "Tree Name", editing.name, "text", 'required maxlength="100"')}<label class="field">Description<textarea name="description" maxlength="2000">${esc(editing.description)}</textarea></label><h3>Whole-Tree Visibility</h3><p class="help">Prerequisites control visibility, not permission to award a rank. Conditions may be nested. Counts use distinct earned badges and exclude the badge at the target placement. A badge cannot count toward revealing itself.</p><div id="tree-rule">${ruleHTML(editing.rule, "rule")}</div><div class="divider"></div><h3>Badge Placements</h3><p class="help">Position badges on a 700 × 540 canvas. Center: 350, 270. Place inner skills nearer the center and new branches farther out. Removing a placement does not remove awards.</p><div id="placement-preview">${placementPreview()}</div><div id="node-editors">${editing.nodes.map((n, i) => nodeForm(n, i)).join("")}</div><button type="button" data-add-node>＋ Place a Badge</button>${editing.id ? `<button type="button" class="danger quiet" data-delete="trees" data-id="${esc(editing.id)}">Delete Tree</button>` : ""}`;
}
function nodeForm(n, i) {
  return `<section class="node-edit"><div class="toolbar"><b>Placement ${i + 1}</b><button type="button" class="small danger" data-remove-node="${i}" style="margin-left:auto">Remove Placement</button></div><label class="field">Badge<select data-node-field="${i}|badgeId">${opts(data.badges, n.badgeId)}</select></label><div class="two-col"><label class="field">Horizontal Position (0–700)<input type="number" min="0" max="700" data-node-field="${i}|x" value="${n.x}" required></label><label class="field">Vertical Position (0–540)<input type="number" min="0" max="540" data-node-field="${i}|y" value="${n.y}" required></label></div><label class="check"><input type="checkbox" data-node-field="${i}|showName" ${n.showName !== false ? "checked" : ""}>Show Name Before Earned</label><h3 style="margin-top:20px">Branch / Badge Visibility</h3>${ruleHTML(n.rule, "nodes." + i + ".rule")}</section>`;
}
function placementPreview() {
  if (!editing.nodes.length)
    return '<p class="help">Add a placement to start shaping the tree.</p>';
  placementIndex = Math.min(placementIndex, editing.nodes.length - 1);
  return `<label class="field">Placement to Move<select id="placement-target">${editing.nodes.map((n, i) => `<option value="${i}" ${i === placementIndex ? "selected" : ""}>${i + 1} · ${esc(data.badges.find((b) => b.id === n.badgeId)?.name || "Badge")}</option>`).join("")}</select></label><p class="help">Choose a placement, then click the map to move it. Numeric controls below offer the same placement access by keyboard.</p><svg id="placement-canvas" viewBox="0 0 700 540" aria-label="Tree placement preview" role="img"><circle cx="350" cy="270" r="200" fill="none" stroke="#554561" stroke-dasharray="4 10"/><circle cx="350" cy="270" r="90" fill="none" stroke="#554561" stroke-dasharray="4 10"/>${editing.nodes.map((n, i) => `<line x1="350" y1="270" x2="${n.x}" y2="${n.y}" stroke="#5f4c70"/><g transform="translate(${n.x} ${n.y})"><polygon points="0,-23 20,-11.5 20,11.5 0,23 -20,11.5 -20,-11.5" fill="${i === placementIndex ? "#79509b" : "#27202f"}" stroke="${i === placementIndex ? "#e4c5ff" : "#71627f"}" stroke-width="2"/><text y="5" text-anchor="middle" fill="#f0e0ff" font-size="13">${i + 1}</text><text y="40" text-anchor="middle" fill="#c9b7da" font-size="11">${esc(data.badges.find((b) => b.id === n.badgeId)?.name || "Badge")}</text></g>`).join("")}</svg>`;
}
function readTreeBasic() {
  editing.name = $('#dialog [name="name"]').value;
  editing.description = $('#dialog [name="description"]').value;
}
function redrawTree() {
  readTreeBasic();
  $("#placement-preview").innerHTML = placementPreview();
  $("#tree-rule").innerHTML = ruleHTML(editing.rule, "rule");
  $("#node-editors").innerHTML = editing.nodes.map(nodeForm).join("");
}
function getPath(path) {
  return path.split(".").reduce((o, k) => o[k], editing);
}
function setPath(path, v) {
  let p = path.split("."),
    key = p.pop();
  let obj = p.reduce((o, k) => o[k], editing);
  obj[key] = v;
}
function newRule(type) {
  return type === "none"
    ? null
    : type === "all" || type === "any"
      ? {
          type,
          rules: [{ type: "badge", badgeId: data.badges[0]?.id, minRank: 1 }],
        }
      : type === "badge"
        ? { type, badgeId: data.badges[0]?.id, minRank: 1 }
        : { type, category: data.badges[0]?.category, count: 1, minRank: 1 };
}
function mappingDialog() {
  editing = structuredClone(data.mappings);
  openDialog(
    "Edit Draft Course References",
    `<p class="help">Teacher-only. Sources and versions must be verified before official use.</p><div id="mapping-editors">${editing.map(mappingForm).join("")}</div><button type="button" data-add-mapping>＋ Add Reference</button>`,
    async () => {
      readMappings();
      await mutate("mappings", { mappings: editing });
      toast("Draft references saved.");
    },
  );
}
function mappingForm(m, i) {
  return `<div class="mapping-row" data-map-row="${i}">${field("courseCode", "Course Code", m.courseCode, "text", "required")}<label class="field">Badge / Competency<select name="badgeId">${opts(data.badges, m.badgeId)}</select></label>${field("reference", "Source & Version", m.reference, "text", 'placeholder="Source title, link, and version/date"')}<label class="field">Notes<textarea name="notes">${esc(m.notes)}</textarea></label><button type="button" class="small danger" data-remove-mapping="${i}">Remove Reference</button></div>`;
}
function readMappings() {
  editing = [...document.querySelectorAll("[data-map-row]")].map((el) =>
    Object.fromEntries(
      ["courseCode", "badgeId", "reference", "notes"].map((k) => [
        k,
        el.querySelector(`[name="${k}"]`).value,
      ]),
    ),
  );
}
async function runAction(fn, el) {
  if (busy) return;
  busy = true;
  if (el) el.disabled = true;
  try {
    await fn();
  } catch (e) {
    const dest = $("#dialog[open] .form-error") || $("#login-form .form-error");
    if (dest) {
      dest.className = "form-error error";
      dest.textContent = e.message;
    } else toast(e.message);
  } finally {
    busy = false;
    if (el?.isConnected) el.disabled = false;
  }
}
document.addEventListener("submit", (e) => {
  if (!["login-form", "dialog-form"].includes(e.target.id)) return;
  e.preventDefault();
  const form = e.target,
    f = new FormData(form);
  runAction(async () => {
    if (form.id === "login-form") {
      resetSessionView();
      session = await api("/api/login", {
        username: f.get("username"),
        password: f.get("password"),
      });
      await refresh();
    } else {
      await dialogSave(f);
      closeDialog();
    }
  }, form.querySelector('[type="submit"]'));
});
document.addEventListener("click", (e) => {
  const canvas = e.target.closest("#placement-canvas");
  if (canvas && editing.nodes[placementIndex]) {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      canvas.getScreenCTM().inverse(),
    );
    editing.nodes[placementIndex].x = Math.round(
      Math.max(0, Math.min(700, p.x)),
    );
    editing.nodes[placementIndex].y = Math.round(
      Math.max(0, Math.min(540, p.y)),
    );
    redrawTree();
    return;
  }
  const el = e.target.closest("button,[data-select-badge]");
  if (!el) return;
  if (el.hasAttribute("data-reload")) {
    location.reload();
    return;
  }
  if (el.hasAttribute("data-close")) {
    if (!busy) closeDialog();
    return;
  }
  if (el.dataset.rankPreset) {
    $('#dialog [name="ranks"]').value =
      el.dataset.rankPreset === "yet"
        ? "Beginning\nDeveloping\nConsistent"
        : [
            "Introduced",
            ...["Beginner", "Intermediate", "Advanced", "Obsidian"].flatMap(
              (t) => ["I", "II", "III"].map((r) => t + " " + r),
            ),
            "Obsidian Mastery",
          ].join("\n");
    return;
  }
  if (el.dataset.demo)
    return runAction(async () => {
      resetSessionView();
      session = await api("/api/demo-login", { account: el.dataset.demo });
      view = "tree";
      await refresh();
    }, el);
  if (el.dataset.view) {
    preview = null;
    view =
      teacher() || ["tree", "history"].includes(el.dataset.view)
        ? el.dataset.view
        : "tree";
    render();
    return;
  }
  if (el.dataset.selectBadge) {
    badgeId = el.dataset.selectBadge;
    render();
    return;
  }
  if (el.dataset.student) {
    studentId = el.dataset.student;
    view = "tree";
    render();
    return;
  }
  if (el.dataset.undo)
    return openDialog(
      "Undo Award Batch",
      "<p>This restores the prior rank and notes for every student in this batch. If another change has happened since, the undo is safely blocked.</p>",
      async () => {
        await mutate("undo", { batchId: el.dataset.undo });
        toast("Award batch undone.");
      },
      "Undo Batch",
    );
  if (el.hasAttribute("data-check-all") || el.hasAttribute("data-check-none")) {
    document
      .querySelectorAll('[name="studentIds"]')
      .forEach((x) => (x.checked = el.hasAttribute("data-check-all")));
    return;
  }
  if (el.dataset.delete) {
    const collection = el.dataset.delete,
      id = el.dataset.id;
    return openDialog(
      "Delete " +
        ({ trees: "Tree", classes: "Class", students: "Student" }[collection] ||
          "Record"),
      "<p>This removes the selected record. The server will block deletion where linked records need to be preserved.</p>",
      async () => {
        await mutate(collection + "/" + encodeURIComponent(id), {}, "DELETE");
        toast("Record removed.");
      },
      "Delete Record",
    );
  }
  if (el.hasAttribute("data-add-node")) {
    if (!data.badges.length) return toast("Create a badge first.");
    editing.nodes.push({
      id: "node-" + crypto.randomUUID(),
      badgeId: data.badges[0].id,
      x: 350,
      y: 80,
      showName: true,
      rule: null,
    });
    redrawTree();
    return;
  }
  if (el.hasAttribute("data-remove-node")) {
    editing.nodes.splice(Number(el.dataset.removeNode), 1);
    redrawTree();
    return;
  }
  if (el.dataset.ruleAdd) {
    getPath(el.dataset.ruleAdd).rules.push(newRule("badge"));
    redrawTree();
    return;
  }
  if (el.dataset.ruleRemove) {
    const p = el.dataset.ruleRemove.split("."),
      i = Number(p.pop());
    getPath(p.join(".")).splice(i, 1);
    redrawTree();
    return;
  }
  if (el.hasAttribute("data-add-mapping")) {
    readMappings();
    editing.push({
      courseCode: "",
      badgeId: data.badges[0]?.id,
      reference: "",
      notes: "",
    });
    $("#mapping-editors").innerHTML = editing.map(mappingForm).join("");
    return;
  }
  if (el.hasAttribute("data-remove-mapping")) {
    readMappings();
    editing.splice(Number(el.dataset.removeMapping), 1);
    $("#mapping-editors").innerHTML = editing.map(mappingForm).join("");
    return;
  }
  const a = el.dataset.action;
  if (a === "logout")
    return runAction(async () => {
      await api("/api/logout", {});
      session = await api("/api/session");
      resetSessionView();
      render();
    }, el);
  if (a === "toggle-list") {
    listMode = !listMode;
    render();
  }
  if (a === "award") awardDialog(el.dataset.badge);
  if (a === "edit-badge") badgeDialog(el.dataset.id);
  if (a === "edit-tree") treeDialog(el.dataset.id);
  if (a === "edit-class") simpleDialog("classes", el.dataset.id);
  if (a === "edit-student") simpleDialog("students", el.dataset.id);
  if (a === "edit-mappings") mappingDialog();
  if (a === "visibility") visibilityDialog();
  if (a === "preview")
    return runAction(async () => {
      if (!studentId) throw Error("Add a student first.");
      preview = await api(
        "/api/teacher/preview/" + encodeURIComponent(studentId),
      );
      render();
    }, el);
  if (a === "end-preview") {
    preview = null;
    render();
  }
  if (a?.startsWith("zoom-")) {
    if (a === "zoom-reset") {
      zoom = 1;
      pan = { x: 0, y: 0 };
    } else
      zoom = Math.min(
        2.5,
        Math.max(0.5, zoom + (a === "zoom-in" ? 0.2 : -0.2)),
      );
    updateMapTransform();
  }
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.id === "placement-target") {
    placementIndex = Number(el.value);
    $("#placement-preview").innerHTML = placementPreview();
    return;
  }
  if (el.id === "class-filter") {
    classId = el.value;
    const ss = data.students.filter(
      (s) => !classId || s.classIds.includes(classId),
    );
    if (!ss.some((s) => s.id === studentId)) studentId = ss[0]?.id || "";
    render();
  }
  if (el.id === "student-select") {
    studentId = el.value;
    render();
  }
  if (el.id === "tree-select") {
    treeId = el.value;
    pan = { x: 0, y: 0 };
    zoom = 1;
    render();
  }
  if (el.id === "award-badge") {
    $("#award-rank").innerHTML = rankOptions(
      data.badges.find((b) => b.id === el.value),
      0,
    );
  }
  if (el.dataset.ruleType) {
    setPath(el.dataset.ruleType, newRule(el.value));
    redrawTree();
  }
  if (el.dataset.ruleField) {
    let [p, k] = el.dataset.ruleField.split("|");
    getPath(p)[k] = ["count", "minRank"].includes(k)
      ? Number(el.value)
      : el.value;
  }
  if (el.dataset.nodeField) {
    let [i, k] = el.dataset.nodeField.split("|");
    editing.nodes[i][k] =
      k === "showName"
        ? el.checked
        : ["x", "y"].includes(k)
          ? Number(el.value)
          : el.value;
    $("#placement-preview").innerHTML = placementPreview();
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "badge-search") {
    let pos = e.target.selectionStart;
    search = e.target.value;
    render();
    let input = $("#badge-search");
    input.focus();
    input.setSelectionRange(pos, pos);
  }
});
document.addEventListener("keydown", (e) => {
  if (
    (e.key === "Enter" || e.key === " ") &&
    e.target.matches("[data-select-badge]")
  ) {
    e.preventDefault();
    badgeId = e.target.dataset.selectBadge;
    render();
  }
});
function updateMapTransform() {
  const el = $("#map-world");
  if (el)
    el.setAttribute(
      "transform",
      `translate(${pan.x} ${pan.y}) translate(350 270) scale(${zoom}) translate(-350 -270)`,
    );
}
function wireMap() {
  const vp = $(".map-viewport");
  if (!vp) return;
  let drag = null;
  vp.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button,.node")) return;
    drag = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    vp.setPointerCapture(e.pointerId);
  });
  vp.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const scale = 700 / vp.clientWidth;
    pan = {
      x: drag.px + (e.clientX - drag.x) * scale,
      y: drag.py + (e.clientY - drag.y) * scale,
    };
    updateMapTransform();
  });
  vp.addEventListener("pointerup", () => (drag = null));
  vp.addEventListener("pointercancel", () => (drag = null));
}
$("#dialog").addEventListener("cancel", (e) => {
  if (busy) {
    e.preventDefault();
    return;
  }
  setTimeout(() => returnFocus?.focus(), 0);
});
init();
