const rawButton = document.getElementById("raw");
const hint = document.getElementById("hint");

const showRawState = (raw) => {
  rawButton.textContent = raw ? "Show rendered Markdown" : "Show raw Markdown";
};

async function init() {
  const settings = await MDR.getSettings();

  for (const input of document.querySelectorAll("[data-key]")) {
    const key = input.dataset.key;
    const prop = input.type === "checkbox" ? "checked" : "value";
    input[prop] = settings[key];
    input.addEventListener("change", () => browser.storage.local.set({ [key]: input[prop] }));
  }

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  try {
    showRawState((await browser.tabs.sendMessage(tab.id, { type: "status" })).raw);
    rawButton.disabled = false;
    rawButton.addEventListener("click", async () => {
      showRawState((await browser.tabs.sendMessage(tab.id, { type: "toggle-raw" })).raw);
    });
  } catch {
    // No content script answered: the active tab is not a rendered Markdown file.
    hint.hidden = false;
  }
}

init();
