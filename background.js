// Open extension in a full tab (not popup) — data persists, more space
chrome.action.onClicked.addListener(() => {
  // Check if our tab is already open
  chrome.tabs.query({}, (tabs) => {
    const existing = tabs.find(t => t.url && t.url.includes(chrome.runtime.id) && t.url.includes('popup.html'));
    if (existing) {
      chrome.tabs.update(existing.id, { active: true });
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
    }
  });
});
