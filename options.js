const input = document.getElementById("apiKey");
const status = document.getElementById("status");

chrome.storage.local.get(["timezonedbApiKey"], (result) => {
  if (result.timezonedbApiKey) {
    input.value = result.timezonedbApiKey;
  }
});

document.getElementById("save").addEventListener("click", () => {
  const value = input.value.trim();
  chrome.storage.local.set({ timezonedbApiKey: value }, () => {
    status.textContent = value ? "Saved." : "Cleared.";
    setTimeout(() => (status.textContent = ""), 2000);
  });
});
