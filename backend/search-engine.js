const https = require("https");

const PHONE_API =
  "https://libphonenumberapi.com/api/phone-numbers/";

const TAVILY_API_KEY =
  process.env.TAVILY_API_KEY;

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
              new Error(
                `HTTP ${res.statusCode}: ${body.slice(0, 300)}`
              )
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
 * Phone metadata
 */
async function getPhoneMetadata(normalized) {
  try {
    const url =
      PHONE_API +
      encodeURIComponent(normalized);

    return await requestJSON(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "PhoneLens/1.0"
      }
    });
  } catch (error) {
    console.error(
      "Phone metadata error:",
      error.message
    );

    return {};
  }
}

/*
 * Tavily public web search
 */
async function searchPublicWeb(phoneNumber, normalized) {
  if (!TAVILY_API_KEY) {
    console.error(
      "TAVILY_API_KEY is not configured."
    );

    return {
      enabled: false,
      results: []
    };
  }

  const cleanNumber = String(phoneNumber || "")
    .replace(/[^\d+]/g, "");

  const normalizedNumber = String(normalized || "")
    .replace(/[^\d+]/g, "");

  /*
   * Search public web pages containing the number.
   * We keep the query focused on the number itself.
   */
  const queryParts = [];

  if (cleanNumber) {
    queryParts.push(`"${cleanNumber}"`);
  }

  if (
    normalizedNumber &&
    normalizedNumber !== cleanNumber
  ) {
    queryParts.push(`"${normalizedNumber}"`);
  }

  const query = queryParts.join(" OR ");

  try {
    const body = JSON.stringify({
      query,
      search_depth: "basic",
      topic: "general",
      max_results: 8,
      include_answer: false,
      include_raw_content: false
    });

    const response = await requestJSON(
      "https://api.tavily.com/search",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization:
            `Bearer ${TAVILY_API_KEY}`
        },

        body
      },

      15000
    );

    const results =
      Array.isArray(response.results)
        ? response.results
        : [];

    return {
      enabled: true,

      results: results.map((item) => ({
        title: item.title || "Public Web Result",

        url: item.url || "",

        snippet:
          item.content ||
          item.snippet ||
          "",

        score:
          typeof item.score === "number"
            ? item.score
            : null
      }))
    };

  } catch (error) {
    console.error(
      "Tavily search error:",
      error.message
    );

    return {
      enabled: true,
      results: [],
      error: "Public web search temporarily unavailable."
    };
  }
}

/*
 * Main PhoneLens search
 */
async function searchPhoneNumber(phoneNumber) {
  const normalized =
    normalizePhone(phoneNumber);

  if (!normalized) {
    throw new Error(
      "Phone number is required"
    );
  }

  const apiData =
    await getPhoneMetadata(normalized);

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

  addResult(
    results,
    "Country",
    data.country
  );

  addResult(
    results,
    "Country Code",
    data.countryCode
      ? `+${data.countryCode}`
      : null
  );

  addResult(
    results,
    "Carrier",
    data.carrier
  );

  addResult(
    results,
    "Line Type",
    data.type
  );

  addResult(
    results,
    "Geographic Region",
    data.location
  );

  addResult(
    results,
    "Timezone",
    data.timezone
  );

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

  addResult(
    results,
    "Sanitized Number",
    data.sanitized
  );

  if (data.possibleTypes.length > 0) {
    addResult(
      results,
      "Possible Types",
      data.possibleTypes.join(", ")
    );
  }

  /*
   * Actual public web results
   */
  const publicWeb =
    await searchPublicWeb(
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

    publicWeb,

    source: "libphonenumberapi + Tavily",

    message:
      "Phone number lookup completed successfully."
  };
}

module.exports = {
  searchPhoneNumber
};
