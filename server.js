import { createServer } from "node:http";
import { readFile } from "node:fs";
import { extname, join } from "node:path";

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const port = process.env.PORT || 4173;

createServer((request, response) => {
  const path = join(process.cwd(), request.url === "/" ? "index.html" : request.url);
  readFile(path, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.setHeader("Content-Type", types[extname(path)] || "text/plain");
    response.end(content);
  });
}).listen(port, () => console.log(`FluentLoop: http://localhost:${port}`));

