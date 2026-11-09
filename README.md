# Markdown Reader

A Firefox extension that renders Markdown files (`.md`, `.markdown`, `.mdown`, `.mkd`, `.mkdn`)
as HTML, for both local files and remote URLs. Inspired by
[simov/markdown-viewer](https://github.com/simov/markdown-viewer).

- GitHub Flavored Markdown (tables, task lists, strikethrough, autolinks)
- GitHub light/dark themes, following the system theme by default
- Syntax highlighting (highlight.js)
- Table of contents sidebar with the current section highlighted
- Mermaid diagrams and KaTeX math (`$inline$`, `$$block$$`), loaded only when a document uses them
- Raw/rendered toggle (popup button or `Alt+Shift+M`)
- Auto reload when the file changes
- Rendered HTML is sanitized with DOMPurify

## Development

```sh
npm install     # also copies the libraries into vendor/
npm start       # runs the extension in a temporary Firefox profile
npm run lint
npm test        # end-to-end test in headless Firefox
npm run build   # creates the zip in web-ext-artifacts/
```

`npm start` and `npm test` use the default Firefox. For another Gecko browser pass its
binary, e.g. `npm start -- --firefox=/Applications/Zen.app/Contents/MacOS/zen` or
`FIREFOX_BIN=... npm test`.

To load it by hand, open `about:debugging#/runtime/this-firefox`, click
**Load Temporary Add-on…** and pick `manifest.json`.

## Local files

Recent Firefox versions make `file://` access opt-in per extension. If local files stay
as plain text, open `about:addons`, select Markdown Reader, and allow access to local
files in the **Permissions** tab.

## Notes

- The extension uses Manifest V2 on purpose: Firefox does not let Manifest V3 extensions
  remove a page's `Content-Security-Policy` header, and hosts such as
  `raw.githubusercontent.com` send one that blocks every image and style.
- For responses on Markdown URLs served as `text/markdown` or `text/plain`, the
  background script rewrites the content type to `text/plain` (so Firefox displays the
  file instead of downloading it) and drops the CSP header. HTML pages are never touched.
- Mermaid ships as the `@mermaid-js/tiny` build to stay under the 5 MB per-file limit of
  addons.mozilla.org. It has no mindmap or architecture diagrams, and no KaTeX inside diagrams.
