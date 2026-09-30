const https = require("https");

const PHONE_API =
  "https://libphonenumberapi.com/api/phone-numbers/";

function normalizePhone(input) {
  let value = String(input || "").trim();

  value = value.replace(/[^\d+]/g, "");

  if (value.startsWith("+")) {
    return "+" + value.slice(1).replace(/\D/g, "");
  }

  const digits = value.replace(/\D/g, "");

  // India default for 10-digit numbers
  if (digits.length === 10) {
    return "+91" + digits;
  }

  return digits;
}

function getJSON(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "PhoneLens/1.0"
        }
      },
      (response) => {
        let body = "";

        response.on("data", (chunk) => {
          body += chunk;
        });

        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(
              new Error(`HTTP ${response.statusCode}`)
            );
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error("Invalid JSON response"));
          }
        });
      }
    );

    request.setTimeout(timeout, () => {
      request.destroy(new Error("Request timeout"));
    });

    request.on("error", reject);
  });
}

function addResult(results, type, value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return;
  }

  results.push({
    type,
    value: String(value)
  });
}

/*
 * Public-web links.
 *
 * These are search links, not scraped private databases.
 * The user can open the search result and inspect the
 * publicly indexed page themselves.
 */
function buildPublicSearches(phone, normalized) {
  const searches = [];

  const clean = String(phone || "")
    .replace(/[^\d]/g, "");

  const normalizedClean = String(normalized || "")
    .replace(/[^\d]/g, "");

  if (clean) {
    searches.push({
      title: "Google Search",
      engine: "Google",
      url:
        "https://www.google.com/search?q=" +
        encodeURIComponent('"' + clean + '"')
    });

    searches.push({
      title: "Bing Search",
      engine: "Bing",
      url:
        "https://www.bing.com/search?q=" +
        encodeURIComponent('"' + clean + '"')
    });
  }

  if (
    normalizedClean &&
    normalizedClean !== clean
  ) {
    searches.push({
      title: "Google International Search",
      engine: "Google",
      url:
        "https://www.google.com/search?q=" +
        encodeURIComponent('"' + normalizedClean + '"')
    });
  }

  return searches;
}

async function searchPhoneNumber(phoneNumber) {
  const normalized = normalizePhone(phoneNumber);

  if (!normalized) {
    throw new Error("Phone number is required");
  }

  const apiURL =
    PHONE_API +
    encodeURIComponent(normalized);

  let apiData = {};

  try {
    apiData = await getJSON(apiURL);
  } catch (error) {
    console.error(
      "Phone metadata API error:",
      error.message
    );
  }

  const components =
    apiData.components || {};

  const formats =
    apiData.formats || {};

  const data = {
    valid:
      typeof apiData.is_valid === "boolean"
        ? apiData.is_valid
        : null,

    possible:
      typeof apiData.is_possible === "boolean"
        ? apiData.is_possible
        : null,

    country:
      apiData.country ?? null,

    countryCode:
      components.country_code ?? null,

    carrier:
      apiData.carrier ?? null,

    type:
      apiData.type ?? null,

    location:
      apiData.geo_name ?? null,

    timezone:
      apiData.timezone ?? null,

    components: {
      areaCode:
        components.area_code ?? null,

      countryCode:
        components.country_code ?? null,

      extension:
        components.extension ?? null,

      localNumber:
        components.local_number ?? null
    },

    formats: {
      e164:
        formats.e164 ?? null,

      international:
        formats.international ?? null,

      national:
        formats.national ?? null
    },

    possibleTypes:
      Array.isArray(apiData.possible_types)
        ? apiData.possible_types
        : [],

    sanitized:
      apiData.sanitized ?? null
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
    data.countryCode
      ? "+" + data.countryCode
      : null
  );

  addResult(results, "Carrier", data.carrier);
  addResult(results, "Line Type", data.type);
  addResult(results, "Geographic Region", data.location);
  addResult(results, "Timezone", data.timezone);

  addResult(
    results,
    "Area Code",
    data.components.areaCode
  );

  addResult(
    results,
    "Local Number",
    data.components.localNumber
  );

  addResult(
    results,
    "International Format",
    data.formats.international
  );

  addResult(
    results,
    "National Format",
    data.formats.national
  );

  addResult(
    results,
    "E.164 Format",
    data.formats.e164
  );

  if (data.possibleTypes.length) {
    addResult(
      results,
      "Possible Types",
      data.possibleTypes.join(", ")
    );
  }

  /*
   * Public search links
   */
  const publicSearches =
    buildPublicSearches(
      phoneNumber,
      normalized
    );

  return {
    phoneNumber: normalized,

    searchedNumber:
      String(phoneNumber || ""),

    normalizedNumber: normalized,

    results,

    data,

    publicWeb: {
      available: publicSearches.length > 0,
      note:
        "These links search publicly indexed web pages. " +
        "PhoneLens does not access private or leaked databases.",
      searches: publicSearches
    },

    source: "libphonenumberapi",

    message:
      "Phone number lookup completed successfully."
  };
}

module.exports = {
  searchPhoneNumber
};
