import { createServer } from "node:http";
import { readFile } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCoachService } from "./ai-service.js";

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": types[".json"] });
  response.end(JSON.stringify(body));
}

function readJson(request, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Request body is too large"));
        request.destroy();
      } else chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Request body must be valid JSON"));
      }
    });
    request.on("error", reject);
  });
}

export function createAppServer(root = process.cwd(), { coachService = createCoachService() } = {}) {
  return createServer(async (request, response) => {
    if (request.url === "/health") {
      json(response, 200, { status: "ok", app: "FluentLoop", ai: coachService.available });
      return;
    }

    if (request.url === "/api/coach" && request.method === "POST") {
      try {
        const payload = await readJson(request);
        if (!payload?.scenario?.title || !payload?.answer || !Array.isArray(payload.messages)) {
          json(response, 400, { error: "scenario, messages, and answer are required" });
          return;
        }
        json(response, 200, await coachService.respond(payload));
      } catch (error) {
        json(response, coachService.available ? 502 : 503, { error: error.message });
      }
      return;
    }

    const pathname = decodeURIComponent((request.url || "/").split("?")[0]);
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = normalize(join(root, relativePath));

    if (!filePath.startsWith(normalize(root))) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    readFile(filePath, (error, content) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      response.setHeader("Content-Type", types[extname(filePath)] || "application/octet-stream");
      response.end(content);
    });
  });
}

export function startServer({
  host = process.env.HOST || "127.0.0.1",
  port = Number(process.env.PORT) || 4173,
  root = process.cwd()
} = {}) {
  const coachService = createCoachService();
  const server = createAppServer(root, { coachService });

  server.on("error", error => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Open http://${host}:${port} or stop the other process.`);
    } else {
      console.error("FluentLoop failed to start:", error.message);
    }
    process.exitCode = 1;
  });

  server.listen(port, host, () => {
    console.log(`FluentLoop is running at http://${host}:${port}`);
    console.log(`Health check: http://${host}:${port}/health`);
    console.log(`AI Coach: ${coachService.available ? "OpenAI enabled" : "offline fallback (set OPENAI_API_KEY to enable)"}`);
    console.log("Keep this window open while using the app. Press Ctrl+C to stop.");
  });

  return server;
}

const isEntryPoint = process.argv[1] &&
  pathToFileURL(fileURLToPath(import.meta.url)).href === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) startServer();
