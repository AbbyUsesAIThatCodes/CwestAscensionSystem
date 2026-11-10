import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "../server/app.mjs";
import { openStore } from "../server/store.mjs";
import { demoModel, evaluate, validateModel } from "../server/model.mjs";
async function start(opts = {}) {
  const app = createServer({ dbPath: ":memory:", demo: true, ...opts });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  async function call(path, { method = "GET", body, auth, headers = {} } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body || method !== "GET"
          ? { "Content-Type": "application/json" }
          : {}),
        ...(auth ? { Cookie: auth.cookie, "X-CSRF-Token": auth.csrf } : {}),
        ...headers,
      },
      ...(method !== "GET" ? { body: JSON.stringify(body || {}) } : {}),
    });
    const data = await res.json();
    return {
      status: res.status,
      data,
      cookie: res.headers.get("set-cookie")?.split(";")[0],
    };
  }
  async function login(account) {
    const r = await call("/api/demo-login", {
      method: "POST",
      body: { account },
    });
    assert.equal(r.status, 200);
    return { cookie: r.cookie, csrf: r.data.csrf };
  }
  return {
    ...app,
    call,
    login,
    stop: () => new Promise((r) => app.server.close(r)),
  };
}
test("role isolation, own-view filtering, CSRF, origin and opaque sessions", async () => {
  const a = await start();
  try {
    assert.equal((await a.call("/api/teacher")).status, 401);
    const teacher = await a.login("teacher"),
      student = await a.login("student-1");
    assert.match(teacher.cookie, /cwest_session=[a-f0-9]{64}/);
    assert.equal((await a.call("/api/teacher", { auth: student })).status, 403);
    assert.equal(
      (await a.call("/api/teacher/preview/student-2", { auth: student }))
        .status,
      403,
    );
    assert.equal(
      (await a.call("/api/student?studentId=student-2", { auth: student }))
        .status,
      403,
    );
    assert.equal(
      (await a.call("/api/student/student-2", { auth: student })).status,
      404,
    );
    assert.equal(
      (
        await a.call("/api/teacher/awards", {
          method: "POST",
          body: { studentIds: ["student-1"], badgeId: "design", rank: 4 },
          auth: student,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await a.call("/api/teacher/awards", {
          method: "POST",
          body: {},
          auth: { ...teacher, csrf: "wrong" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await a.call("/api/login", {
          method: "POST",
          body: {},
          headers: { Origin: "https://evil.example" },
        })
      ).status,
      403,
    );
    await a.call("/api/teacher/overrides", {
      method: "POST",
      auth: teacher,
      body: {
        studentId: "student-1",
        treeId: "tree-1",
        nodeId: "node-design",
        visibility: "hide",
      },
    });
    const view = (await a.call("/api/student", { auth: student })).data;
    assert.equal(view.student.id, "student-1");
    assert.ok(!view.badges.some((b) => b.id === "design"));
    const serialized = JSON.stringify(view);
    for (const forbidden of [
      "privateNote",
      "Fictional teacher-only",
      "student-2",
      "prerequisite",
      "minRank",
      "mappings",
      '"rule"',
    ])
      assert.ok(!serialized.includes(forbidden), forbidden);
    assert.equal(
      (await a.call("/api/logout", { method: "POST", auth: student })).status,
      200,
    );
    assert.equal((await a.call("/api/student", { auth: student })).status, 401);
  } finally {
    await a.stop();
  }
});
test("bulk awards are atomic, audited, removable and undo uses version protection", async () => {
  const a = await start();
  try {
    const auth = await a.login("teacher");
    const award = (body) =>
      a.call("/api/teacher/awards", { method: "POST", auth, body });
    const before = (await a.call("/api/teacher", { auth })).data;
    assert.equal(
      (
        await award({
          studentIds: ["student-1", "missing"],
          badgeId: "design",
          rank: 3,
        })
      ).status,
      400,
    );
    assert.deepEqual(
      (await a.call("/api/teacher", { auth })).data.awards,
      before.awards,
    );
    const first = await award({
      studentIds: ["student-1", "student-2"],
      badgeId: "design",
      rank: 3,
      privateNote: "Private",
      publicNote: "Public",
    });
    assert.equal(first.status, 200);
    assert.equal(first.data.history.length, 2);
    assert.equal(first.data.history[0].actor, "Demo Teacher");
    const second = await award({
      studentIds: ["student-1"],
      badgeId: "design",
      rank: 4,
    });
    assert.equal(
      (
        await a.call("/api/teacher/undo", {
          method: "POST",
          auth,
          body: { batchId: first.data.batchId },
        })
      ).status,
      409,
    );
    const undone = await a.call("/api/teacher/undo", {
      method: "POST",
      auth,
      body: { batchId: second.data.batchId },
    });
    assert.equal(undone.status, 200);
    assert.equal(
      undone.data.awards.find(
        (x) => x.studentId === "student-1" && x.badgeId === "design",
      ).rank,
      3,
    );
    assert.equal(
      (
        await a.call("/api/teacher/undo", {
          method: "POST",
          auth,
          body: { batchId: second.data.batchId },
        })
      ).status,
      409,
    );
    assert.equal(
      (await award({ studentIds: ["student-1"], badgeId: "design", rank: 0 }))
        .status,
      200,
    );
    const b = before.badges.find((b) => b.id === "design");
    assert.equal(
      (
        await a.call("/api/teacher/badges", {
          method: "POST",
          auth,
          body: { ...b, ranks: ["Different"] },
        })
      ).status,
      400,
    );
  } finally {
    await a.stop();
  }
});
test("rule semantics, distinct-category counting, bounds and cycles", () => {
  const m = demoModel();
  assert.equal(
    evaluate(
      {
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
      },
      m,
      "student-1",
    ),
    true,
  );
  assert.equal(
    evaluate(
      {
        type: "category",
        category: "Visual Foundations",
        count: 3,
        minRank: 1,
      },
      m,
      "student-1",
    ),
    false,
  );
  assert.equal(
    evaluate(
      {
        type: "any",
        rules: [
          { type: "badge", badgeId: "story", minRank: 4 },
          { type: "badge", badgeId: "code", minRank: 1 },
        ],
      },
      m,
      "student-1",
    ),
    true,
  );
  validateModel(m);
  m.trees[0].nodes[0].rule = { type: "badge", badgeId: "capstone", minRank: 1 };
  assert.throws(() => validateModel(m), /cycle/);
  m.trees[0].nodes[0].rule = { type: "badge", badgeId: "design", minRank: 99 };
  assert.throws(() => validateModel(m), /invalid badge or rank/);
});
test("persistence, demo separation and production fails closed", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cwest-test-"));
  try {
    const path = join(dir, "demo.sqlite");
    let a = await start({ dbPath: path });
    const auth = await a.login("teacher");
    await a.call("/api/teacher/classes", {
      method: "POST",
      auth,
      body: {
        id: "new-class",
        name: "Fictional New Class",
        courseCode: "340110",
      },
    });
    await a.stop();
    a = await start({ dbPath: path });
    assert.ok(a.store.read().classes.some((c) => c.id === "new-class"));
    await a.stop();
    assert.throws(() => openStore(path, { demo: false }), /separate/);
    assert.throws(
      () => createServer({ dbPath: join(dir, "prod.sqlite"), demo: false }),
      /No teacher/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("production credentials use real login and never demo elevation", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cwest-auth-"));
  try {
    const dbPath = join(dir, "prod.sqlite");
    const store = openStore(dbPath);
    store.provision({
      username: "test-teacher",
      name: "Fictional Test Teacher",
      role: "teacher",
      password: "test-only-not-real-secret",
    });
    assert.throws(
      () =>
        store.provision({
          username: "test-student",
          name: "Fictional Student",
          role: "student",
          studentId: "missing",
          password: "test-only-not-real-secret",
        }),
      /existing roster/,
    );
    assert.ok(
      !store.db
        .prepare("SELECT password FROM accounts")
        .get()
        .password.includes("test-only"),
    );
    store.close();
    const a = await start({ demo: false, dbPath, secureCookies: false });
    try {
      assert.equal(
        (
          await a.call("/api/demo-login", {
            method: "POST",
            body: { account: "teacher" },
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await a.call("/api/login", {
            method: "POST",
            body: { username: "test-teacher", password: "wrong" },
          })
        ).status,
        401,
      );
      const r = await a.call("/api/login", {
        method: "POST",
        body: {
          username: "test-teacher",
          password: "test-only-not-real-secret",
        },
      });
      assert.equal(r.status, 200);
      assert.equal(r.data.user.role, "teacher");
      assert.ok(!JSON.stringify(r.data).includes("password"));
    } finally {
      await a.stop();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("category rules can include the target category; ANY can escape a circular branch", () => {
  const m = demoModel();
  m.trees[0].nodes[0].rule = {
    type: "category",
    category: "Visual Foundations",
    count: 1,
    minRank: 1,
  };
  assert.doesNotThrow(() => validateModel(m));
  m.trees[0].nodes[0].rule = {
    type: "any",
    rules: [
      { type: "badge", badgeId: "capstone", minRank: 1 },
      { type: "badge", badgeId: "code", minRank: 1 },
    ],
  };
  assert.doesNotThrow(() => validateModel(m));
  m.trees[0].nodes[0].rule = {
    type: "category",
    category: "Visual Foundations",
    count: 99,
    minRank: 1,
  };
  assert.throws(() => validateModel(m), /eligible distinct/);
});
test("teacher roster, badge and tree CRUD; anonymous silhouette is stripped at the server", async () => {
  const a = await start();
  try {
    const auth = await a.login("teacher");
    const post = (kind, body) =>
      a.call("/api/teacher/" + kind, { method: "POST", auth, body });
    assert.equal(
      (
        await post("classes", {
          id: "new",
          name: "Example Section",
          courseCode: "340350",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await post("students", {
          id: "new-student",
          name: "Fictional Learner",
          classIds: ["new"],
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await post("students", {
          id: "new-student",
          name: "Updated Fictional Learner",
          classIds: ["class-1"],
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await post("badges", {
          id: "new-badge",
          name: "Secret Skill Name",
          category: "Creative",
          description: "Secret earning recipe",
          icon: "star",
          ranks: ["Start", "Develop"],
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await post("trees", {
          id: "new-tree",
          name: "Example Tree",
          nodes: [
            {
              id: "new-node",
              badgeId: "new-badge",
              x: 10,
              y: 20,
              showName: false,
              rule: null,
            },
          ],
        })
      ).status,
      200,
    );
    const student = await a.login("student-1");
    let view = (await a.call("/api/student", { auth: student })).data;
    assert.ok(!JSON.stringify(view).includes("Secret Skill Name"));
    assert.ok(!JSON.stringify(view).includes("Secret earning recipe"));
    assert.equal(view.badges.find((b) => b.id === "new-badge").concealed, true);
    assert.equal(
      (
        await post("trees", {
          id: "new-tree",
          name: "Updated Example Tree",
          nodes: [
            {
              id: "new-node",
              badgeId: "new-badge",
              x: 50,
              y: 40,
              showName: true,
              rule: null,
            },
          ],
        })
      ).status,
      200,
    );
    view = (await a.call("/api/student", { auth: student })).data;
    assert.ok(JSON.stringify(view).includes("Secret Skill Name"));
    assert.ok(!JSON.stringify(view).includes("Secret earning recipe"));
    for (const [kind, id] of [
      ["trees", "new-tree"],
      ["badges", "new-badge"],
      ["students", "new-student"],
      ["classes", "new"],
    ])
      assert.equal(
        (await a.call(`/api/teacher/${kind}/${id}`, { method: "DELETE", auth }))
          .status,
        200,
      );
  } finally {
    await a.stop();
  }
});
test("production student password login, secure-cookie defaults and logout revocation", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cwest-student-"));
  try {
    const dbPath = join(dir, "prod.sqlite");
    const store = openStore(dbPath);
    store.save(demoModel());
    store.provision({
      username: "fictional-teacher",
      name: "Fictional Teacher",
      role: "teacher",
      password: "test-only-example-password",
    });
    store.provision({
      username: "fictional-student",
      name: "Fictional Student",
      role: "student",
      studentId: "student-2",
      password: "test-only-example-password",
    });
    store.close();
    const a = await start({ demo: false, dbPath });
    try {
      const res = await fetch(
        `http://127.0.0.1:${a.server.address().port}/api/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "fictional-student",
            password: "test-only-example-password",
          }),
        },
      );
      assert.equal(res.status, 200);
      const cookie = res.headers.get("set-cookie");
      for (const flag of ["HttpOnly", "SameSite=Strict", "Secure"])
        assert.ok(cookie.includes(flag));
      const data = await res.json();
      const auth = { cookie: cookie.split(";")[0], csrf: data.csrf };
      assert.equal(
        (await a.call("/api/student", { auth })).data.student.id,
        "student-2",
      );
      assert.equal((await a.call("/api/teacher", { auth })).status, 403);
      await a.call("/api/logout", { method: "POST", auth });
      assert.equal((await a.call("/api/student", { auth })).status, 401);
    } finally {
      await a.stop();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
