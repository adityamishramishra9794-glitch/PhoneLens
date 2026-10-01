const https = require("https");

const PHONE_API = "https://libphonenumberapi.com/api/phone-numbers/";
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

const PROFILE_DOMAINS = [
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "justdial.com",
  "indiamart.com",
  "sulekha.com",
  "github.com"
];

/* =========================
   PHONE NORMALIZATION
========================= */

function normalizePhone(input) {
  let value = String(input || "").trim();
  value = value.replace(/[^\d+]/g, "");

  if (value.startsWith("+")) {
    return "+" + value.slice(1).replace(/\D/g, "");
  }

  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return "+91" + digits;
  }

  return digits;
}

/* =========================
   HTTP JSON REQUEST
========================= */

function requestJSON(url, options = {}, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: options.method || "GET",
        headers: options.headers || {}
      },
      (res) => {
        let body = "";

        res.on("data", (chunk) => {
          body += chunk;
        });

        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(
              new Error(`HTTP ${res.statusCode}: ${body.slice(0, 300)}`)
            );
          }

          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error("Invalid JSON response"));
          }
        });
      }
    );

    req.setTimeout(timeout, () => {
      req.destroy(new Error("Request timeout"));
    });

    req.on("error", reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

/* =========================
   RESULT HELPER
========================= */

function addResult(results, type, value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return;
  }

  results.push({ type, value: String(value) });
}

/* =========================
   PHONE METADATA
========================= */

async function getPhoneMetadata(normalized) {
  try {
    const url = PHONE_API + encodeURIComponent(normalized);

    return await requestJSON(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "PhoneLens/1.0"
      }
    });
  } catch (error) {
    console.error("Phone metadata error:", error.message);
    return {};
  }
}

/* =========================
   NUMBER VARIANTS
========================= */

function getNumberVariants(phoneNumber, normalized) {
  const variants = new Set();

  const original = String(phoneNumber || "").trim();
  const normalizedValue = String(normalized || "").trim();
  const originalDigits = original.replace(/\D/g, "");
  const normalizedDigits = normalizedValue.replace(/\D/g, "");

  if (original) variants.add(original);
  if (normalizedValue) variants.add(normalizedValue);
  if (originalDigits) variants.add(originalDigits);
  if (normalizedDigits) variants.add(normalizedDigits);

  // Indian 10-digit local format
  let indianLocal = "";

  if (normalizedDigits.length === 12 && normalizedDigits.startsWith("91")) {
    indianLocal = normalizedDigits.slice(2);
  }

  if (originalDigits.length === 10) {
    indianLocal = originalDigits;
  }

  if (indianLocal.length === 10) {
    const a = indianLocal.slice(0, 5);
    const b = indianLocal.slice(5);

    variants.add(indianLocal);
    variants.add(`+91 ${a} ${b}`);
    variants.add(`+91-${a}-${b}`);
    variants.add(`+91${indianLocal}`);
    variants.add(`${a} ${b}`);
    variants.add(`${a}-${b}`);
    variants.add(`0${indianLocal}`);
  }

  return {
    variants: [...variants],
    originalDigits,
    normalizedDigits,
    indianLocal
  };
}

/* =========================
   TAVILY HELPERS
========================= */

async function tavilySearch(query, extra = {}) {
  const body = JSON.stringify({
    query,
    search_depth: "advanced",
    topic: "general",
    max_results: 10,
    include_answer: false,
    include_raw_content: true,
    ...extra
  });

  const res = await requestJSON(
    "https://api.tavily.com/search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${TAVILY_API_KEY}`
      },
      body
    },
    25000
  );

  return Array.isArray(res.results) ? res.results : [];
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function isProfileSite(url) {
  return PROFILE_DOMAINS.some((d) => String(url || "").includes(d));
}

/* =========================
   PUBLIC WEB SEARCH
========================= */

async function searchPublicWeb(phoneNumber, normalized) {
  if (!TAVILY_API_KEY) {
    console.error("TAVILY_API_KEY is not configured.");

    return {
      enabled: false,
      results: [],
      error: "Public web search is not configured."
    };
  }

  const numberInfo = getNumberVariants(phoneNumber, normalized);
  const { variants, originalDigits, normalizedDigits, indianLocal } =
    numberInfo;

  function containsPhoneNumber(text) {
    const digits = digitsOnly(text);
    if (!digits) return false;

    if (normalizedDigits.length >= 10 && digits.includes(normalizedDigits)) {
      return true;
    }

    if (originalDigits.length >= 10 && digits.includes(originalDigits)) {
      return true;
    }

    if (indianLocal.length === 10 && digits.includes(indianLocal)) {
      return true;
    }

    return false;
  }

  // Formatted variants (spaces / dashes) are what web pages actually use
  const exactQueries = variants
    .filter((v) => digitsOnly(v).length >= 10)
    .slice(0, 5)
    .map((v) => `"${v}"`);

  if (exactQueries.length === 0) {
    return { enabled: true, results: [] };
  }

  try {
    const jobs = [
      // each variant searched separately
      ...exactQueries.map((q) => tavilySearch(q)),

      // targeted search on profile sites
      tavilySearch(`${indianLocal || normalizedDigits} contact profile`, {
        include_domains: PROFILE_DOMAINS
      })
    ];

    const settled = await Promise.allSettled(jobs);

    const seen = new Set();
    const merged = [];

    for (const s of settled) {
      if (s.status !== "fulfilled") {
        console.error("Tavily job failed:", s.reason && s.reason.message);
        continue;
      }

      for (const item of s.value) {
        if (!item.url || seen.has(item.url)) continue;
        seen.add(item.url);
        merged.push(item);
      }
    }

    const filtered = merged
      .map((item) => {
        const title = item.title || "";
        const url = item.url || "";
        const content = item.content || item.snippet || "";
        const raw = item.raw_content || "";

        const exactMatch = containsPhoneNumber(
          `${title} ${url} ${content} ${raw}`
        );

        return {
          title: title || "Public Web Result",
          url,
          snippet: content,
          score: typeof item.score === "number" ? item.score : null,
          exactMatch,
          profileSite: isProfileSite(url),
          // exact number found = high, profile site only = low
          confidence: exactMatch ? "high" : "low"
        };
      })
      .filter((i) => i.exactMatch || i.profileSite)
      .sort(
        (a, b) =>
          Number(b.exactMatch) - Number(a.exactMatch) ||
          (b.score || 0) - (a.score || 0)
      )
      .slice(0, 10);

    return { enabled: true, results: filtered };
  } catch (error) {
    // Tavily failure must NOT break the main phone lookup
    console.error("Tavily search error:", error.message);

    return {
      enabled: true,
      results: [],
      error: "Public web search temporarily unavailable."
    };
  }
}

/* =========================
   MAIN PHONE SEARCH
========================= */

async function searchPhoneNumber(phoneNumber) {
  const normalized = normalizePhone(phoneNumber);

  if (!normalized) {
    throw new Error("Phone number is required");
  }

  const apiData = await getPhoneMetadata(normalized);

  const components = apiData.components || {};
  const formats = apiData.formats || {};

  const data = {
    valid: typeof apiData.is_valid === "boolean" ? apiData.is_valid : null,
    possible:
      typeof apiData.is_possible === "boolean" ? apiData.is_possible : null,
    country: apiData.country ?? null,
    countryCode: components.country_code ?? null,
    carrier: apiData.carrier ?? null,
    type: apiData.type ?? null,
    location: apiData.geo_name ?? null,
    timezone: apiData.timezone ?? null,

    components: {
      areaCode: components.area_code ?? null,
      countryCode: components.country_code ?? null,
      extension: components.extension ?? null,
      localNumber: components.local_number ?? null
    },

    formats: {
      e164: formats.e164 ?? null,
      international: formats.international ?? null,
      national: formats.national ?? null
    },

    possibleTypes: Array.isArray(apiData.possible_types)
      ? apiData.possible_types
      : [],

    sanitized: apiData.sanitized ?? null
  };

  const results = [];

  addResult(
    results,
    "Validation",
    data.valid === true
      ? "Valid number"
      : data.valid === false
        ? "Invalid number"
        : null
  );

  addResult(
    results,
    "Possible",
    data.possible === true
      ? "Number format is possible"
      : data.possible === false
        ? "Number format is not possible"
        : null
  );

  addResult(results, "Country", data.country);
  addResult(
    results,
    "Country Code",
    data.countryCode ? `+${data.countryCode}` : null
  );
  addResult(results, "Carrier", data.carrier);
  addResult(results, "Line Type", data.type);
  addResult(results, "Geographic Region", data.location);
  addResult(results, "Timezone", data.timezone);
  addResult(results, "Area Code", data.components.areaCode);
  addResult(results, "Local Number", data.components.localNumber);
  addResult(results, "International Format", data.formats.international);
  addResult(results, "National Format", data.formats.national);
  addResult(results, "E.164 Format", data.formats.e164);
  addResult(results, "Sanitized Number", data.sanitized);

  if (data.possibleTypes.length > 0) {
    addResult(results, "Possible Types", data.possibleTypes.join(", "));
  }

  // Public web search is separate; metadata works even if it fails
  const publicWeb = await searchPublicWeb(phoneNumber, normalized);

  return {
    phoneNumber: normalized,
    searchedNumber: String(phoneNumber || ""),
    normalizedNumber: normalized,
    results,
    data,
    publicWeb,
    source: "libphonenumberapi + Tavily",
    message: "Phone number lookup completed successfully."
  };
}

module.exports = {
  searchPhoneNumber
};
        
