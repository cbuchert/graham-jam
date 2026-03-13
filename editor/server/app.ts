import { Hono } from "hono";
import { cors } from "hono/cors";

const VITE_ORIGIN = "http://localhost:5173";

export const app = new Hono();

app.use(
  "/*",
  cors({
    origin: VITE_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.get("/api/health", (c) => c.json({ ok: true }));
