function getPath(url) {
	url = url.toLowerCase();
	if (url.endsWith("/")) url = url.slice(0, -1);
	if (url.startsWith("https://")) return url.substring(19);
	if (url.startsWith("http://")) return url.substring(18);
	if (url.startsWith("anilist.co/")) return url.substring(10);
	return url;
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (!tab.url) return;
	const url = tab.url.toString().toLowerCase();
	if (!url.startsWith("https://anilist.co")) return;
	const path = getPath(url);

	if (changeInfo.status == "complete") {
		if (/user\/.+\/animelist/.test(path)) {
			chrome.scripting.executeScript({
				target: { tabId: tabId, allFrames: false },
				files: ["main.js"]
			});
		}
	}
});