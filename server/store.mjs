import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { emptyModel, demoModel, fail } from "./model.mjs";
export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(password, stored) {
  try {
    const [salt, hash] = stored.split(":");
    return timingSafeEqual(
      Buffer.from(hash, "hex"),
      scryptSync(password, salt, 64),
    );
  } catch {
    return false;
  }
}
export function openStore(path, { demo = false } = {}) {
  if (path !== ":memory:")
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('teacher','student')),studentId TEXT,password TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,userId TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires INTEGER NOT NULL);",
  );
  const mode = db.prepare("SELECT value FROM settings WHERE key=?").get("mode");
  if (mode && mode.value !== (demo ? "demo" : "production")) {
    db.close();
    throw new Error("Demo and production databases must be separate.");
  }
  db.prepare("INSERT OR IGNORE INTO settings VALUES (?,?)").run(
    "mode",
    demo ? "demo" : "production",
  );
  db.prepare("INSERT OR IGNORE INTO settings VALUES (?,?)").run(
    "model",
    JSON.stringify(demo ? demoModel() : emptyModel()),
  );
  const read = () =>
    JSON.parse(
      db.prepare("SELECT value FROM settings WHERE key=?").get("model").value,
    );
  const save = (m) =>
    db
      .prepare("UPDATE settings SET value=? WHERE key=?")
      .run(JSON.stringify(m), "model");
  function provision({ username, name, role, studentId, password }) {
    if (
      !/^[a-zA-Z0-9._-]{3,80}$/.test(username) ||
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 200 ||
      !["teacher", "student"].includes(role) ||
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 1024
    )
      fail(
        "Use a valid username, name, explicit role, and password of at least 12 characters.",
      );
    if (role === "student" && !read().students.some((s) => s.id === studentId))
      fail("Student accounts must map to an existing roster student ID.");
    const existing = db
      .prepare("SELECT id FROM accounts WHERE username=?")
      .get(username);
    if (existing)
      fail("Username exists. Use revoke then provision to change identity.");
    db.prepare("INSERT INTO accounts VALUES (?,?,?,?,?,?)").run(
      randomUUID(),
      username,
      name,
      role,
      role === "student" ? studentId : null,
      hashPassword(password),
    );
  }
  if (demo && !db.prepare("SELECT id FROM accounts LIMIT 1").get()) {
    provision({
      username: "teacher",
      name: "Demo Teacher",
      role: "teacher",
      password: randomBytes(32).toString("hex"),
    });
    for (const id of ["student-1", "student-2"])
      provision({
        username: id,
        name: read().students.find((s) => s.id === id).name,
        role: "student",
        studentId: id,
        password: randomBytes(32).toString("hex"),
      });
  }
  return {
    db,
    read,
    save,
    provision,
    close: () => db.close(),
    transaction(fn) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = fn();
        db.exec("COMMIT");
        return result;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
