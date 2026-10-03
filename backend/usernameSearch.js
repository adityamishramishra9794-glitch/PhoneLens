
// Username -> kin public sites pe is naam ka profile page maujood hai.
// Sirf public profile URL ka status check hota hai (200 = page hai, 404 = nahi).
// Koi login, scraping ya private data use nahi hota.

const https = require("https");

// {u} = username
const SITES = [
  // dev / tech
  ["GitHub", "https://github.com/{u}"],
  ["GitLab", "https://gitlab.com/{u}"],
  ["Dev.to", "https://dev.to/{u}"],
  ["CodePen", "https://codepen.io/{u}"],
  ["Replit", "https://replit.com/@{u}"],
  ["Kaggle", "https://www.kaggle.com/{u}"],
  ["LeetCode", "https://leetcode.com/{u}/"],
  ["Codeforces", "https://codeforces.com/profile/{u}"],
  ["HackerRank", "https://www.hackerrank.com/{u}"],
  ["HackerOne", "https://hackerone.com/{u}"],
  ["npm", "https://www.npmjs.com/~{u}"],
  ["PyPI", "https://pypi.org/user/{u}/"],
  ["Docker Hub", "https://hub.docker.com/u/{u}"],
  ["Keybase", "https://keybase.io/{u}"],
  ["Gravatar", "https://gravatar.com/{u}"],
  // blogs / writing
  ["Medium", "https://medium.com/@{u}"],
  ["WordPress", "https://{u}.wordpress.com"],
  ["Blogspot", "https://{u}.blogspot.com"],
  ["Tumblr", "https://{u}.tumblr.com"],
  ["Substack", "https://{u}.substack.com"],
  ["Wattpad", "https://www.wattpad.com/user/{u}"],
  // design / media
  ["Behance", "https://www.behance.net/{u}"],
  ["Dribbble", "https://dribbble.com/{u}"],
  ["Pinterest", "https://www.pinterest.com/{u}/"],
  ["Flickr", "https://www.flickr.com/people/{u}"],
  ["Vimeo", "https://vimeo.com/{u}"],
  ["SoundCloud", "https://soundcloud.com/{u}"],
  ["Last.fm", "https://www.last.fm/user/{u}"],
  ["Mixcloud", "https://www.mixcloud.com/{u}/"],
  // profile / link pages
  ["About.me", "https://about.me/{u}"],
  ["Linktree", "https://linktr.ee/{u}"],
  ["Product Hunt", "https://www.producthunt.com/@{u}"],
  ["Speaker Deck", "https://speakerdeck.com/{u}"],
  ["SlideShare", "https://www.slideshare.net/{u}"],
  ["Scribd", "https://www.scribd.com/{u}"],
  ["Issuu", "https://issuu.com/{u}"],
  ["Reddit", "https://www.reddit.com/user/{u}"],
  ["Quora", "https://www.quora.com/profile/{u}"],
  ["Telegram", "https://t.me/{u}"]
];

// Ye sites bots ko login-wall ya block karti hain, server se pakka check nahi
// ho sakta. Inke liye sirf manual check link diya jaata hai.
const MANUAL_SITES = [
  ["Instagram", "https://www.instagram.com/{u}/"],
  ["Facebook", "https://www.facebook.com/{u}"],
  ["X (Twitter)", "https://x.com/{u}"],
  ["LinkedIn", "https://www.linkedin.com/in/{u}"],
  ["YouTube", "https://www.youtube.com/@{u}"],
  ["TikTok", "https://www.tiktok.com/@{u}"],
  ["Snapchat", "https://www.snapchat.com/add/{u}"]
];

function checkUrl(url, timeout = 8000) {
  return new Promise((resolve) => {
    const req = https.request(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; PhoneLens/1.0; public profile check)",
          Accept: "text/html"
        }
      },
      (res) => {
        res.resume(); // body ki zarurat nahi
        resolve(res.statusCode);
      }
    );

    req.setTimeout(timeout, () => req.destroy(new Error("timeout")));
    req.on("error", () => resolve(0));
    req.end();
  });
}

async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  }

  await Promise.all(Array.from({ length: limit }, run));
  return results;
}

function cleanUsername(input) {
  const u = String(input || "").trim().replace(/^@/, "");
  return /^[A-Za-z0-9._-]{2,40}$/.test(u) ? u : null;
}

async function searchUsername(input) {
  const username = cleanUsername(input);

  if (!username) {
    throw new Error(
      "Valid username daal (2-40 characters: letters, numbers, . _ -)"
    );
  }

  const checked = await runPool(SITES, 10, async ([site, tpl]) => {
    const url = tpl.replace("{u}", encodeURIComponent(username));
    const status = await checkUrl(url);

    return {
      site,
      url,
      status,
      found: status === 200,
      notFound: status === 404 || status === 410
    };
  });

  const found = checked
    .filter((r) => r.found)
    .map((r) => ({ site: r.site, url: r.url }));

  const unknown = checked.filter((r) => !r.found && !r.notFound).length;

  const manual = MANUAL_SITES.map(([site, tpl]) => ({
    site,
    url: tpl.replace("{u}", encodeURIComponent(username))
  }));

  return {
    username,
    checkedSites: SITES.length,
    found,
    unknownCount: unknown,
    manual,
    note:
      "Same username kisi aur insaan ka bhi ho sakta hai. Match ko pakka mat maan, khud kholke verify kar."
  };
}

module.exports = { searchUsername };
        
