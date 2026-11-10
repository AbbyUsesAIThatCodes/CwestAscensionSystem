import { createServer } from "./app.mjs";
const demo = process.argv.includes("--demo");
const host = process.env.HOST || "127.0.0.1";
if (demo && !["127.0.0.1", "::1", "localhost"].includes(host))
  throw new Error("Demo must bind only to loopback.");
if (!demo && process.env.CWEST_HTTPS !== "1")
  throw new Error(
    "Production requires HTTPS termination. Set CWEST_HTTPS=1 only behind your HTTPS reverse proxy.",
  );
const dbPath =
  process.env.CWEST_DB ||
  (demo ? "data/demo.sqlite" : "data/production.sqlite");
const { server } = createServer({ demo, dbPath, secureCookies: !demo });
server.listen(Number(process.env.PORT || 3000), host, () =>
  console.log(
    `Cwest Ascension ${demo ? "FICTIONAL DEMO" : "production"} listening on ${host}:${server.address().port}`,
  ),
);
