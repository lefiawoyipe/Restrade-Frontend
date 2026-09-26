// Serves the production build's prerendered HTML for isolated UI tests.
// This is NOT an auth/authorization test and never runs in the application.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1:3107");
    let relative;
    if (url.pathname.startsWith("/_next/static/"))
      relative = ".next/static/" + url.pathname.slice(14);
    else if (url.pathname.startsWith("/images/"))
      relative = "public" + url.pathname;
    else if (url.pathname === "/_next/image")
      relative = "public" + url.searchParams.get("url");
    else
      relative =
        ".next/server/app/" +
        (url.pathname === "/" ? "index" : url.pathname.slice(1)) +
        (url.searchParams.has("_rsc") ? ".rsc" : ".html");
    const file = path.resolve(root, relative);
    if (
      !file.startsWith(root + path.sep) ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    ) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "text/x-component",
    );
    res.end(fs.readFileSync(file));
  })
  .listen(3107, "127.0.0.1");
