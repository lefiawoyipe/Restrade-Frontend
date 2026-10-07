// Serves the production build's prerendered HTML for isolated UI tests.
// This is NOT an auth/authorization test and never runs in the application.
import http from "node:http";
import next from "next";
const renderer = next({ dev: false, hostname: "127.0.0.1", port: 3107 });
await renderer.prepare();
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
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1:3107");
    if (/^\/orders\/[^/]+$/.test(url.pathname)) {
      // Direct render intentionally bypasses middleware in this isolated fixture.
      try {
        const html = await renderer.renderToHTML(
          req,
          res,
          url.pathname,
          Object.fromEntries(url.searchParams),
        );
        if (!res.writableEnded) {
          res.setHeader(
            "Content-Type",
            url.searchParams.has("_rsc") ? "text/x-component" : "text/html",
          );
          res.end(html);
        }
      } catch (error) {
        console.error(error);
        if (!res.writableEnded) {
          res.writeHead(500);
          res.end("Fixture render failed");
        }
      }
      return;
    }
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
