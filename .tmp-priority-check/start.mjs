import { registerHooks } from "node:module";
import { createServer } from "../Frontend/node_modules/vite/dist/node/index.js";

process.env.PORT = "4123";
process.env.HOST = "127.0.0.1";
process.env.ADMIN_PASSWORD = "Local-test-admin-2026-only";
process.env.DATABASE_URL = "";
process.env.NODE_ENV = "test";
process.env.DB_SSL = "false";
process.env.VITE_API_URL = "http://localhost:4123/api";
delete process.env.GOOGLE_SERVICE_ACCOUNT;
delete process.env.SESSION_COOKIE_SECURE;
delete process.env.SESSION_COOKIE_SAME_SITE;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "pg" && context.parentURL === new URL("../backend/db.js", import.meta.url).href) {
      return { url: new URL("./pg-adapter.mjs", import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  }
});

await import("../backend/server.js");
const { default: pool, dbReady } = await import("../backend/db.js");
await dbReady;
await pool.query("INSERT INTO clients (name, address) VALUES ($1, $2), ($3, $4)", [
  "Client test mobile A", "Adresse de test A", "Client test mobile B", "Adresse de test B"
]);

const frontend = await createServer({
  root: new URL("../Frontend", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
  configLoader: "native",
  server: { host: "127.0.0.1", port: 5177, strictPort: true }
});
await frontend.listen();
console.log("TEST_READY http://localhost:5177 — isolated in-memory PostgreSQL, no production data");
