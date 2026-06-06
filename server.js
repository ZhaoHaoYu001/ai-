import { createServer } from "node:http";
import { readFile } from "node:fs";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCoachService } from "./ai-service.js";
import { createAzurePronunciationService } from "./pronunciation-service.js";
import { createTranscriptionService } from "./transcription-service.js";

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": types[".json"],
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(body));
}

function ndjson(response, body) {
  response.write(`${JSON.stringify(body)}\n`);
}

function requestError(status, message) {
  return Object.assign(new Error(message), { status });
}

function readJson(request, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    request.on("data", chunk => {
      if (failed) return;
      size += chunk.length;
      if (size > limit) {
        failed = true;
        reject(requestError(413, "Request body is too large"));
      } else chunks.push(chunk);
    });
    request.on("end", () => {
      if (failed) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(requestError(400, "Request body must be valid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function readBody(request, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", chunk => {
      size += chunk.length;
      if (size > limit) reject(requestError(413, "Audio is too large"));
      else chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function validateCoachPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (typeof payload.answer !== "string" || !payload.answer.trim() || payload.answer.length > 2000) return false;
  if (typeof payload.scenario?.title !== "string" || !payload.scenario.title.trim() || payload.scenario.title.length > 100) return false;
  if (!Array.isArray(payload.messages) || payload.messages.length > 12) return false;
  return payload.messages.every(message =>
    ["coach", "user"].includes(message?.role) &&
    typeof message.text === "string" &&
    message.text.length <= 2000
  );
}

export function createAppServer(root = process.cwd(), {
  coachService = createCoachService(),
  pronunciationService = createAzurePronunciationService(),
  transcriptionService
} = {}) {
  const transcriptionServicePromise = transcriptionService ?
    Promise.resolve(transcriptionService) : createTranscriptionService();
  const rootPath = resolve(root);
  return createServer(async (request, response) => {
    if (request.url === "/health") {
      const activeTranscription = await transcriptionServicePromise;
      json(response, 200, { status: "ok", app: "FluentLoop", ai: coachService.available, aiProvider: coachService.available ? coachService.provider : null, aiModel: coachService.available ? coachService.model : null, pronunciation: pronunciationService.available, transcription: activeTranscription.available, transcriptionProvider: activeTranscription.provider });
      return;
    }

    if (request.url === "/api/coach" && request.method === "POST") {
      try {
        if (!request.headers["content-type"]?.startsWith("application/json")) {
          throw requestError(415, "Content-Type must be application/json");
        }
        const payload = await readJson(request);
        if (!validateCoachPayload(payload)) throw requestError(400, "Invalid coach request");
        const result = await coachService.respond(payload);
        json(response, 200, { ...result, provider: coachService.provider, model: coachService.model });
      } catch (error) {
        const status = error.status || (coachService.available ? 502 : 503);
        const message = error.status ? error.message : "Coach service is temporarily unavailable";
        json(response, status, { error: message });
      }
      return;
    }

    if (request.url === "/api/coach/stream" && request.method === "POST") {
      try {
        if (!request.headers["content-type"]?.startsWith("application/json")) throw requestError(415, "Content-Type must be application/json");
        const payload = await readJson(request);
        if (!validateCoachPayload(payload)) throw requestError(400, "Invalid coach request");
        if (!coachService.respondStream) throw new Error("Streaming coach is unavailable");
        response.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" });
        ndjson(response, { type: "accepted" });
        const result = await coachService.respondStream(payload, delta => ndjson(response, { type: "delta", delta }));
        ndjson(response, { type: "final", result: { ...result, provider: coachService.provider, model: coachService.model } });
        response.end();
      } catch (error) {
        if (!response.headersSent) json(response, error.status || (coachService.available ? 502 : 503), { error: error.status ? error.message : "Coach stream is temporarily unavailable" });
        else {
          ndjson(response, { type: "error", error: "Coach stream is temporarily unavailable" });
          response.end();
        }
      }
      return;
    }

    if (request.url?.startsWith("/api/pronunciation?") && request.method === "POST") {
      try {
        const text = new URL(request.url, "http://localhost").searchParams.get("text")?.trim();
        if (!text || text.length > 2000) throw requestError(400, "Reference text is required");
        if (!request.headers["content-type"]?.startsWith("audio/wav")) throw requestError(415, "Content-Type must be audio/wav");
        json(response, 200, await pronunciationService.assess(await readBody(request), text));
      } catch (error) {
        const status = error.status || (pronunciationService.available ? 502 : 503);
        json(response, status, { error: error.status ? error.message : "Pronunciation service is temporarily unavailable" });
      }
      return;
    }

    if (request.url === "/api/transcribe" && request.method === "POST") {
      try {
        if (!request.headers["content-type"]?.startsWith("audio/wav")) throw requestError(415, "Content-Type must be audio/wav");
        const activeTranscription = await transcriptionServicePromise;
        json(response, 200, await activeTranscription.transcribe(await readBody(request)));
      } catch (error) {
        const activeTranscription = await transcriptionServicePromise;
        const status = error.status || (activeTranscription.available ? 502 : 503);
        json(response, status, { error: error.status ? error.message : "Speech transcription is temporarily unavailable" });
      }
      return;
    }

    const pathname = decodeURIComponent((request.url || "/").split("?")[0]);
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = resolve(rootPath, relativePath);
    const pathFromRoot = relative(rootPath, filePath);

    if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) {
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
      response.setHeader("X-Content-Type-Options", "nosniff");
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
  const pronunciationService = createAzurePronunciationService();
  const transcriptionServicePromise = createTranscriptionService();
  const transcriptionWarmupPromise = transcriptionServicePromise
    .then(service => service.warmup?.())
    .catch(error => console.warn(`Transcription warmup skipped: ${error.message}`));
  const server = createAppServer(root, { coachService, pronunciationService, transcriptionService: transcriptionServicePromise });

  server.on("error", error => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Open http://${host}:${port} or stop the other process.`);
    } else {
      console.error("FluentLoop failed to start:", error.message);
    }
    process.exitCode = 1;
  });

  server.listen(port, host, async () => {
    const transcriptionService = await transcriptionServicePromise;
    console.log(`FluentLoop is running at http://${host}:${port}`);
    console.log(`Health check: http://${host}:${port}/health`);
    console.log(`AI Coach: ${coachService.available ? `${coachService.provider} / ${coachService.model}` : "offline fallback (set ANTHROPIC_AUTH_TOKEN or OPENAI_API_KEY to enable)"}`);
    console.log(`Pronunciation: ${pronunciationService.available ? "Azure Speech enabled" : "browser proxy (set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION to enable)"}`);
    console.log(`Transcription fallback: ${transcriptionService.provider}${transcriptionService.model ? ` / ${transcriptionService.model}` : ""}`);
    if (transcriptionService.warmup) {
      console.log("Local Whisper is warming up in the background for a faster first response.");
      void transcriptionWarmupPromise;
    }
    console.log("Keep this window open while using the app. Press Ctrl+C to stop.");
  });

  return server;
}

const isEntryPoint = process.argv[1] &&
  pathToFileURL(fileURLToPath(import.meta.url)).href === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) startServer();
