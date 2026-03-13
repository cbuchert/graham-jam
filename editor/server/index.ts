import { serve } from "@hono/node-server";
import { app } from "./app.ts";

const PORT = 3001;

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Scene editor API running on http://localhost:${PORT}`);
});
