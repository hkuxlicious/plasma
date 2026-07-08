import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "dist");
const requestedPort = Number(process.env.PORT || process.argv[2] || 4173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function resolveRequest(url) {
  const pathname = decodeURIComponent(new URL(url, "http://127.0.0.1").pathname);
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(root, safePath === path.sep ? "index.html" : safePath);
  const resolved = fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : path.join(root, "index.html");
  return resolved.startsWith(root) ? resolved : path.join(root, "index.html");
}

const server = http.createServer((request, response) => {
  const filePath = resolveRequest(request.url || "/");
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(contents);
  });
});

server.listen(requestedPort, "127.0.0.1", () => {
  console.log(`Skill Dashboard served at http://127.0.0.1:${requestedPort}`);
});
