(() => {
  if (MDR.started) return;
  MDR.started = true;

  const darkQuery = matchMedia("(prefers-color-scheme: dark)");
  const loaded = new Set();
  const state = { text: "", settings: null, theme: null, timer: null };
  let pre, content, toc;
  let queue = Promise.resolve();

  const send = (message) => browser.runtime.sendMessage(message);

  async function ensure(lib) {
    if (loaded.has(lib)) return;
    await send({ type: "load", lib });
    loaded.add(lib);
  }

  function compile(text, { highlight, math }) {
    const md = new marked.Marked({ gfm: true });

    if (highlight) {
      md.use(
        markedHighlight.markedHighlight({
          langPrefix: "hljs language-",
          highlight: (code, lang) =>
            lang && lang !== "mermaid" && hljs.getLanguage(lang)
              ? hljs.highlight(code, { language: lang }).value
              : code,
        }),
      );
    }
    if (math) md.use(markedKatex({ throwOnError: false }));

    // The Markdown is untrusted and the page CSP was removed: always sanitize.
    return DOMPurify.sanitize(md.parse(text), { RETURN_DOM_FRAGMENT: true });
  }

  async function drawDiagrams(theme) {
    const nodes = [];
    for (const code of content.querySelectorAll("pre > code.language-mermaid")) {
      const node = document.createElement("div");
      node.className = "mermaid";
      node.textContent = code.textContent;
      code.parentElement.replaceWith(node);
      nodes.push(node);
    }
    if (!nodes.length) return;

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: theme === "dark" ? "dark" : "default",
    });
    await mermaid.run({ nodes, suppressErrors: true });
  }

  async function render() {
    const settings = state.settings;
    const text = state.text;
    const scroll = { x: scrollX, y: scrollY };

    const theme = settings.theme === "auto" ? (darkQuery.matches ? "dark" : "light") : settings.theme;
    if (theme !== state.theme) {
      await send({ type: "theme", theme });
      state.theme = theme;
    }

    const math = settings.math && text.includes("$");
    const diagrams = settings.mermaid && /^\s*(```|~~~)\s*mermaid/m.test(text);
    if (math) await ensure("katex");
    if (diagrams) await ensure("mermaid");

    const fragment = compile(text, { highlight: settings.highlight, math });
    const headings = MDR.anchorHeadings(fragment);
    content.replaceChildren(fragment);
    MDR.buildToc(toc, headings);

    const root = document.documentElement;
    root.dataset.mdrTheme = theme;
    root.dataset.mdrWidth = settings.width;
    root.toggleAttribute("data-mdr-toc", settings.toc && headings.length > 1);

    const title = content.querySelector("h1")?.textContent.trim();
    document.title = title || decodeURIComponent(location.pathname.split("/").pop());

    scrollTo(scroll.x, scroll.y);
    if (diagrams) {
      await drawDiagrams(theme);
      scrollTo(scroll.x, scroll.y);
    }
  }

  // Renders run one at a time so a settings change never interleaves with a reload.
  function enqueueRender() {
    queue = queue.then(render).catch((error) => console.error("Markdown Reader:", error));
    return queue;
  }

  async function checkForChanges() {
    if (document.hidden) return;
    try {
      const response = await fetch(location.href, { cache: "no-store" });
      if (!response.ok) return;
      const text = await response.text();
      if (text === state.text) return;
      state.text = text;
      pre.textContent = text;
      enqueueRender();
    } catch {
      // The file is unreachable right now (e.g. mid-save); try again next tick.
    }
  }

  function scheduleReload() {
    clearInterval(state.timer);
    state.timer = state.settings.autoreload ? setInterval(checkForChanges, 1000) : null;
  }

  function toggleRaw() {
    return document.documentElement.toggleAttribute("data-mdr-raw");
  }

  async function start() {
    if (document.readyState === "loading") {
      await new Promise((resolve) =>
        document.addEventListener("DOMContentLoaded", resolve, { once: true }),
      );
    }

    pre = document.querySelector("body > pre");
    if (!pre) return;
    state.text = pre.textContent;
    state.settings = await MDR.getSettings();

    pre.classList.add("mdr-source");
    toc = document.createElement("nav");
    toc.id = "mdr-toc";
    content = document.createElement("main");
    content.id = "mdr-content";
    content.className = "markdown-body";
    document.body.append(toc, content);

    await enqueueRender();
    document.documentElement.setAttribute("data-mdr", "");
    scheduleReload();

    if (location.hash.length > 1) {
      document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    }

    let ticking = false;
    addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          MDR.updateToc();
        });
      },
      { passive: true },
    );

    darkQuery.addEventListener("change", () => {
      if (state.settings.theme === "auto") enqueueRender();
    });

    browser.storage.onChanged.addListener(async (changes, area) => {
      if (area !== "local") return;
      state.settings = await MDR.getSettings();
      scheduleReload();
      enqueueRender();
    });

    browser.runtime.onMessage.addListener((message) => {
      const root = document.documentElement;
      if (message.type === "toggle-raw") return Promise.resolve({ raw: toggleRaw() });
      if (message.type === "status") return Promise.resolve({ raw: root.hasAttribute("data-mdr-raw") });
    });
  }

  start();
})();
