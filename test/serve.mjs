// Serves test/fixtures the way a strict host (e.g. raw.githubusercontent.com)
// would: Markdown as text/markdown behind a CSP that blocks everything.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.FIXTURES_DIR || join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const port = Number(process.env.PORT) || 8765;
const types = { ".md": "text/markdown", ".svg": "image/svg+xml", ".html": "text/html" };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = normalize(decodeURIComponent(url.pathname));
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, {
      // ?type= overrides the content type, e.g. to serve an HTML page from a .md URL.
      "Content-Type": url.searchParams.get("type") || types[extname(path)] || "application/octet-stream",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`http://localhost:${port}/sample.md`));
