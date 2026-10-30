// Opens the side panel when the toolbar icon is clicked.
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.action.onClicked.addListener(async (tab: chrome.tabs.Tab) => {
  if (tab.id) await chrome.sidePanel.open({ tabId: tab.id });
});
