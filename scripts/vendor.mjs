// Copies the browser builds of the dependencies from node_modules into vendor/.
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const modules = join(root, "node_modules");
const vendor = join(root, "vendor");

const files = {
  "marked/lib/marked.umd.js": "marked.js",
  "marked-highlight/lib/index.umd.js": "marked-highlight.js",
  "marked-katex-extension/lib/index.umd.js": "marked-katex.js",
  "dompurify/dist/purify.min.js": "purify.js",
  "@highlightjs/cdn-assets/highlight.min.js": "highlight.js",
  "@highlightjs/cdn-assets/styles/github.min.css": "hljs-light.css",
  "@highlightjs/cdn-assets/styles/github-dark.min.css": "hljs-dark.css",
  "github-markdown-css/github-markdown-light.css": "markdown-light.css",
  "github-markdown-css/github-markdown-dark.css": "markdown-dark.css",
  "katex/dist/katex.min.js": "katex/katex.js",
  "katex/dist/katex.min.css": "katex/katex.css",
  "@mermaid-js/tiny/dist/mermaid.tiny.js": "mermaid.js",
};

rmSync(vendor, { recursive: true, force: true });
mkdirSync(join(vendor, "katex/fonts"), { recursive: true });

for (const [from, to] of Object.entries(files)) {
  cpSync(join(modules, from), join(vendor, to));
}

// katex.css lists woff2 first, so the other font formats are never fetched.
const fonts = join(modules, "katex/dist/fonts");
for (const font of readdirSync(fonts).filter((name) => name.endsWith(".woff2"))) {
  cpSync(join(fonts, font), join(vendor, "katex/fonts", font));
}

console.log(`vendor/ ready (${Object.keys(files).length} files + KaTeX fonts)`);
