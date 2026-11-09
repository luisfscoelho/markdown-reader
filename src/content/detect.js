// Runs on URLs that look like Markdown. Only documents Firefox shows as plain
// text are rendered, so HTML pages such as github.com/.../README.md are left alone.
if (["text/plain", "text/markdown", "text/x-markdown"].includes(document.contentType)) {
  browser.runtime
    .sendMessage({ type: "render" })
    .catch((error) => console.error("Markdown Reader:", error));
}
