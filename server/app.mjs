import { createServer as httpServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { openStore, verifyPassword, hashPassword } from "./store.mjs";
import { fail, mutate, studentView } from "./model.mjs";
const digest = (x) => createHash("sha256").update(x).digest("hex");
const DUMMY = hashPassword(randomBytes(32).toString("hex"));
const loopback = (ip) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip);
export function createApp({
  dbPath = "data/production.sqlite",
  demo = false,
  publicDir = resolve("public"),
  secureCookies = !demo,
  requireAccounts = true,
} = {}) {
  const store = openStore(dbPath, { demo });
  if (
    !demo &&
    requireAccounts &&
    !store.db.prepare("SELECT id FROM accounts WHERE role=?").get("teacher")
  ) {
    store.close();
    throw new Error(
      "No teacher account configured. Provision an explicit teacher with scripts/accounts.mjs before starting.",
    );
  }
  const attempts = new Map();
  function session(req) {
    const token = (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("cwest_session="))
      ?.slice(14);
    if (!token) return null;
    const s = store.db
      .prepare(
        "SELECT sessions.csrf,sessions.expires,accounts.id,accounts.username,accounts.name,accounts.role,accounts.studentId FROM sessions JOIN accounts ON accounts.id=sessions.userId WHERE sessions.token=?",
      )
      .get(digest(token));
    return s && s.expires > Date.now() ? s : null;
  }
  const user = (s) =>
    s
      ? {
          id: s.id,
          username: s.username,
          name: s.name,
          role: s.role,
          studentId: s.studentId,
        }
      : null;
  function issue(res, a, req) {
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(32).toString("hex");
    const old = (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("cwest_session="))
      ?.slice(14);
    if (old)
      store.db.prepare("DELETE FROM sessions WHERE token=?").run(digest(old));
    store.db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    store.db
      .prepare("INSERT INTO sessions VALUES (?,?,?,?)")
      .run(digest(token), a.id, csrf, Date.now() + 8 * 3600000);
    res.setHeader(
      "Set-Cookie",
      `cwest_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secureCookies ? "; Secure" : ""}`,
    );
    return { user: user(a), csrf, demo };
  }
  async function body(req) {
    let data = "";
    for await (const c of req) {
      data += c;
      if (Buffer.byteLength(data) > 200000) fail("Request too large.", 413);
    }
    try {
      const parsed = data ? JSON.parse(data) : {};
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        fail("JSON object required.");
      return parsed;
    } catch {
      fail("Invalid JSON.");
    }
  }
  function json(res, status, value) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
    });
    res.end(JSON.stringify(value));
  }
  async function handler(req, res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    res.setHeader("Cache-Control", "no-store");
    try {
      if (demo && !loopback(req.socket.remoteAddress))
        fail("Demo is loopback-only.", 403);
      const url = new URL(req.url, "http://localhost");
      const path = url.pathname;
      const method = req.method;
      const s = session(req);
      if (path.startsWith("/api/")) {
        if (!["GET", "POST", "DELETE"].includes(method))
          fail("Method not allowed.", 405);
        if (method !== "GET") {
          const origin = req.headers.origin;
          if (origin) {
            let o;
            try {
              o = new URL(origin);
            } catch {
              fail("Invalid origin.", 403);
            }
            if (o.host !== req.headers.host)
              fail("Cross-origin request blocked.", 403);
          }
          if (req.headers["sec-fetch-site"] === "cross-site")
            fail("Cross-site request blocked.", 403);
          if (
            !(req.headers["content-type"] || "").startsWith("application/json")
          )
            fail("JSON required.", 415);
        }
        if (path === "/api/session" && method === "GET")
          return json(res, 200, {
            user: user(s),
            ...(s ? { csrf: s.csrf } : {}),
            demo,
          });
        if (path === "/api/login" && method === "POST") {
          const b = await body(req);
          if (
            typeof b.username !== "string" ||
            typeof b.password !== "string" ||
            b.password.length > 1024
          )
            fail("Invalid username or password.", 401);
          const key = req.socket.remoteAddress;
          const throttle = attempts.get(key);
          if (throttle && throttle.until > Date.now() && throttle.count >= 10)
            fail("Too many login attempts. Try again in 15 minutes.", 429);
          const a = store.db
            .prepare("SELECT * FROM accounts WHERE username=?")
            .get(b.username);
          const valid = verifyPassword(b.password, a?.password || DUMMY);
          if (!a || !valid) {
            const record =
              throttle && throttle.until > Date.now()
                ? throttle
                : { count: 0, until: Date.now() + 15 * 60000 };
            record.count++;
            attempts.set(key, record);
            fail("Invalid username or password.", 401);
          }
          attempts.delete(key);
          return json(res, 200, issue(res, a, req));
        }
        if (path === "/api/demo-login" && method === "POST") {
          if (!demo) fail("Not found.", 404);
          const b = await body(req);
          if (!["teacher", "student-1", "student-2"].includes(b.account))
            fail("Invalid fictional account.");
          const a = store.db
            .prepare("SELECT * FROM accounts WHERE username=?")
            .get(b.account);
          return json(res, 200, issue(res, a, req));
        }
        if (!s) fail("Please sign in.", 401);
        if (method !== "GET" && req.headers["x-csrf-token"] !== s.csrf)
          fail("Invalid CSRF token. Reload and try again.", 403);
        if (path === "/api/logout" && method === "POST") {
          store.db.prepare("DELETE FROM sessions WHERE userId=?").run(s.id);
          res.setHeader(
            "Set-Cookie",
            `cwest_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureCookies ? "; Secure" : ""}`,
          );
          return json(res, 200, { user: null, demo });
        }
        if (path === "/api/student" && method === "GET") {
          if (s.role !== "student") fail("Student account required.", 403);
          if (url.search)
            fail(
              "Student identity comes only from the signed-in session.",
              403,
            );
          return json(res, 200, studentView(store.read(), s.studentId));
        }
        if (path.startsWith("/api/teacher")) {
          if (s.role !== "teacher") fail("Teacher access required.", 403);
          if (path === "/api/teacher" && method === "GET")
            return json(res, 200, store.read());
          const preview = path.match(/^\/api\/teacher\/preview\/([\w-]+)$/);
          if (preview && method === "GET")
            return json(res, 200, studentView(store.read(), preview[1]));
          const match = path.match(
            /^\/api\/teacher\/(badges|trees|classes|students|awards|undo|overrides|mappings)(?:\/([\w-]+))?$/,
          );
          if (
            match &&
            ((method === "POST" && !match[2]) ||
              (method === "DELETE" &&
                match[2] &&
                ["badges", "trees", "classes", "students"].includes(match[1])))
          ) {
            const b = await body(req);
            const result = store.transaction(() => {
              const m = store.read();
              if (
                method === "DELETE" &&
                match[1] === "students" &&
                store.db
                  .prepare("SELECT id FROM accounts WHERE studentId=?")
                  .get(match[2])
              )
                fail(
                  "Revoke this student account before deleting the roster entry.",
                );
              const batchId = mutate(
                m,
                match[1],
                b,
                user(s),
                method === "DELETE" ? match[2] : undefined,
              );
              store.save(m);
              return { ...m, ...(batchId ? { batchId } : {}) };
            });
            return json(res, 200, result);
          }
        }
        fail("Not found.", 404);
      }
      if (method !== "GET" && method !== "HEAD")
        fail("Method not allowed.", 405);
      const filename = resolve(
        publicDir,
        "." + decodeURIComponent(path === "/" ? "/index.html" : path),
      );
      if (!filename.startsWith(resolve(publicDir) + sep))
        fail("Not found.", 404);
      let file;
      try {
        if (!(await stat(filename)).isFile()) fail("Not found.", 404);
        file = await readFile(filename);
      } catch {
        fail("Not found.", 404);
      }
      const types = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".webp": "image/webp",
        ".ico": "image/x-icon",
      };
      res.writeHead(200, {
        "Content-Type": types[extname(filename)] || "application/octet-stream",
      });
      res.end(method === "HEAD" ? undefined : file);
    } catch (e) {
      if (!res.headersSent)
        json(res, e.status || 500, {
          error: e.status ? e.message : "An internal error occurred.",
        });
      else res.end();
    }
  }
  return { handler, store, close: () => store.close() };
}
export function createServer(options) {
  const app = createApp(options);
  const server = httpServer(app.handler);
  server.on("close", app.close);
  return { server, ...app };
}
