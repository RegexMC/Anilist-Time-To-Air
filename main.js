{
	function log(text) {
		console.log(
			"%cAnilistTTA%c " + text,
			"background: #0B165D;color:#FFF;padding:2px;border-radius: 2px;line-height: 10px;",
			""
		);
	}

	function warn(text) {
		console.warn(
			"%cAnilistTTA%c " + text,
			"background: #0B165D;color:#FFF;padding:2px;border-radius: 2px;line-height: 10px;",
			""
		);
	}

	function error(text) {
		console.error(
			"%cAnilistTTA%c " + text,
			"background: #0B165D;color:#FFF;padding:2px;border-radius: 2px;line-height: 10px;",
			""
		);
	}

	function getData() {
		log("Data fetched from local storage.");
		return new Promise((resolve, reject) => {
			chrome.storage.local.get("data", (res) => resolve(res.data));
		});
	}

	function setData(data) {
		log("Data set in local storage");
		console.log(data);
		chrome.storage.local.set({ data: data });
	}

	var observeDOM = (function () {
		var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

		return function (obj, callback) {
			if (!obj || obj.nodeType !== 1) return;

			if (MutationObserver) {
				// define a new observer
				var mutationObserver = new MutationObserver(callback);

				// have the observer observe for changes in children
				mutationObserver.observe(obj, { childList: true, subtree: true });
				return mutationObserver;
			}

			// browser support fallback
			else if (window.addEventListener) {
				obj.addEventListener("DOMNodeInserted", callback, false);
				obj.addEventListener("DOMNodeRemoved", callback, false);
			}
		};
	})();

	getData().then((data) => {
		if (!document.location.pathname.toLowerCase().includes("animelist")) return;

		let localData = data;
		if (!data || localData.entries == null) {
			getAirDates().then((entries) => {
				if (entries == null) {
					error("Entries is null.");
					return;
				}
				localData = { lastUpdatedTime: Math.floor(Date.now() / 1000), entries: entries };
				setData({ lastUpdatedTime: Math.floor(Date.now() / 1000), entries: entries });
			});
		} else {
			if (Math.floor(Date.now() / 1000) - data.lastUpdatedTime >= 3600) {
				// Hour has progressed since last fetch.
				getAirDates().then((entries) => {
					if (entries == null) {
						error("Entries is null.");
						return;
					}
					localData = { lastUpdatedTime: Math.floor(Date.now() / 1000), entries: entries };
					setData({ lastUpdatedTime: Math.floor(Date.now() / 1000), entries: entries });
				});
			}
		}

		observeDOM(document.body, (m) => {
			if (!document.location.pathname.toLowerCase().includes("animelist")) return;

			let element = document.querySelector(
				"#app > div.page-content > div > div.content.container > div > div.lists"
			);

			if (!element) {
				warn("Could not find div.lists element");
				return;
			}

			for (let i = 1; i < element.children.length; i++) {
				let list = element.children[i].lastChild.lastChild;
				for (let j = 0; j < list.children.length; j++) {
					let listItem = list.children[j];
					let titleDiv = listItem.children[1]; // <div title>
					let titleLink = titleDiv.children[0];
					let href = titleLink.href;

					if (!href.includes("anilist.co")) {
						titleLink = titleDiv.children[1]; // MAL-Sync occupying first position.
						href = titleLink.href;
					}

					let mediaId = href.substring("https://anilist.co/anime/".length).split("/")[0]; // 53432
					let media = localData.entries.find((obj) => obj.media.id == mediaId).media; // {id, nextAiringEpisode{airingAt, timeUntilAiring}, startDate{day, month, year}}

					if (titleDiv.lastChild.id != mediaId) {
						var e = document.createElement("a");
						e.id = mediaId;
						e.style.marginRight = 0;
						e.style.whiteSpace = "nowrap";

						if (media.nextAiringEpisode && media.nextAiringEpisode.timeUntilAiring) {
							let tUA = media.nextAiringEpisode.timeUntilAiring;
							let hUA = tUA / 60 / 60; // hours till next episode airing.
							if (hUA >= 24) {
								let days = Math.floor(hUA / 24);
								let remainder = hUA % 24;
								let hours = Math.floor(remainder);

								e.innerText = days + "d " + hours + "h";
							} else {
								e.innerText = Math.floor(hUA) + "h";
							}
						} else {
							let todaysDate = new Date();

							if (media.startDate.day != null) {
								let formattedAirDate =
									media.startDate.day + "/" + media.startDate.month + "/" + media.startDate.year;
								let airDate = new Date(formattedAirDate);

								if (airDate >= todaysDate) {
									e.innerText = formattedAirDate;
								}
							} else if (
								media.startDate.year != null &&
								todaysDate.getFullYear() < media.startDate.year
							) {
								e.innerText = media.startDate.year;
							}
						}

						if (e.innerText.length > 0) {
							log(mediaId + " : " + e.innerText);
						}

						titleDiv.appendChild(e);
					}
				}
			}
		});
	});

	async function getAirDates() {
		var query = `
	query ($username: String) {
		MediaListCollection(userName: $username, type: ANIME) {
		  lists {
			entries {
			  media {
				id
				startDate {
				  year
				  month
				  day
				}
				nextAiringEpisode {
				  airingAt
				  timeUntilAiring
				}
			  }
			}
		  }
		}
	  }	  
	`;

		const username = document.querySelector(
			"#app > div.page-content > div > div.header-wrap > div.banner > div.container > div > div.name-wrapper > h1"
		).innerText;

		if (!username || username.length == 0) {
			warn("Username element not found or empty.");
			return;
		}

		var variables = {
			username: username
		};

		var f = await fetch("https://graphql.anilist.co/", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Accept": "application/json"
			},
			body: JSON.stringify({
				query: query,
				variables: variables
			})
		});

		var json = await f.json();

		log("New data fetched from API with username " + username);

		const data = json.data;
		const lists = data.MediaListCollection.lists;
		const entries = lists.flatMap((obj) => obj.entries);

		return entries;
	}
}
