import { createServer } from "node:http";
import { readFile } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

export function createAppServer(root = process.cwd()) {
  return createServer((request, response) => {
    if (request.url === "/health") {
      response.setHeader("Content-Type", types[".json"]);
      response.end(JSON.stringify({ status: "ok", app: "FluentLoop" }));
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
  const server = createAppServer(root);

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
    console.log("Keep this window open while using the app. Press Ctrl+C to stop.");
  });

  return server;
}

const isEntryPoint = process.argv[1] &&
  pathToFileURL(fileURLToPath(import.meta.url)).href === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) startServer();
