// Shared by the background script, the content scripts and the popup.
globalThis.MDR = globalThis.MDR || {};

MDR.defaults = {
  theme: "auto", // auto | light | dark
  width: "fixed", // fixed | full
  toc: true,
  autoreload: false,
  highlight: true,
  mermaid: true,
  math: true,
};

MDR.getSettings = async () => ({
  ...MDR.defaults,
  ...(await browser.storage.local.get(Object.keys(MDR.defaults))),
});
