const MD_PATH = /\.(md|markdown|mdown|mkdn?)$/i;
const MD_TYPES = ["text/markdown", "text/x-markdown"];

const BASE = {
  css: ["src/content/content.css"],
  js: [
    "vendor/marked.js",
    "vendor/marked-highlight.js",
    "vendor/highlight.js",
    "vendor/purify.js",
    "src/settings.js",
    "src/content/toc.js",
    "src/content/render.js",
  ],
};

// Heavy libraries, injected only when a document needs them.
const LIBS = {
  katex: {
    css: ["vendor/katex/katex.css"],
    js: ["vendor/katex/katex.js", "vendor/marked-katex.js"],
  },
  mermaid: {
    js: ["vendor/mermaid.js"],
  },
};

const THEMES = {
  light: ["vendor/markdown-light.css", "vendor/hljs-light.css"],
  dark: ["vendor/markdown-dark.css", "vendor/hljs-dark.css"],
};

async function inject(target, { css, js }) {
  if (css) await browser.scripting.insertCSS({ target, files: css });
  if (js) await browser.scripting.executeScript({ target, files: js });
}

async function setTheme(target, theme) {
  if (!THEMES[theme]) return;
  await browser.scripting.insertCSS({ target, files: THEMES[theme] });
  const other = theme === "dark" ? "light" : "dark";
  await browser.scripting.removeCSS({ target, files: THEMES[other] });
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (sender.tab?.id === undefined) return;
  const target = { tabId: sender.tab.id, frameIds: [0] };

  switch (message.type) {
    case "render":
      return inject(target, BASE);
    case "load":
      return LIBS[message.lib] ? inject(target, LIBS[message.lib]) : undefined;
    case "theme":
      return setTheme(target, message.theme);
  }
});

browser.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-raw") return;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  // Rejects when the tab is not a rendered Markdown document.
  if (tab) browser.tabs.sendMessage(tab.id, { type: "toggle-raw" }).catch(() => {});
});

// Servers often send Markdown as text/markdown (which Firefox offers to
// download) and with a CSP that blocks images and styles. Serve it as plain
// text and drop the CSP; the rendered HTML is sanitized by DOMPurify instead.
browser.webRequest.onHeadersReceived.addListener(
  ({ url, responseHeaders }) => {
    if (!MD_PATH.test(new URL(url).pathname)) return;

    const contentType = responseHeaders.find((h) => h.name.toLowerCase() === "content-type");
    if (!contentType) return;
    const [type, ...params] = contentType.value.split(";").map((part) => part.trim());

    if (MD_TYPES.includes(type.toLowerCase())) {
      const charset = params.find((p) => /^charset=/i.test(p)) || "charset=utf-8";
      contentType.value = `text/plain; ${charset}`;
    } else if (type.toLowerCase() !== "text/plain") {
      return;
    }

    return {
      responseHeaders: responseHeaders.filter(
        (h) => h.name.toLowerCase() !== "content-security-policy",
      ),
    };
  },
  { urls: ["<all_urls>"], types: ["main_frame"] },
  ["blocking", "responseHeaders"],
);
