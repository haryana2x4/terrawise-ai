import { createChatHandler } from "./chat/handler.mjs";
import { createLiveService } from "./chat/live-service.mjs";

const chat = createChatHandler({ service: createLiveService() });

const PREFIX = /^\/(?:functions\/v1\/)?(?:app|app-d[0-9a-f]{32})(?=\/|$)/;

Deno.serve(async (request: Request) => {
  const path = new URL(request.url).pathname.replace(PREFIX, "");
  if (path.startsWith("/api/chat")) return chat(request);
  if (path === "/health") {
    return Response.json(
      { ok: true, service: "orion", mode: "live" },
      { headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(
    { ok: false, error: "not_found" },
    { status: 404, headers: { "cache-control": "no-store" } },
  );
});
