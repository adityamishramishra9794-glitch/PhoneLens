const https = require("https");

/*
 * PhoneLens Search Engine
 *
 * Features:
 * - Cleans and normalizes phone numbers
 * - Automatically assumes India (+91) for 10-digit numbers
 * - Uses the free libphonenumber API
 * - Has a timeout so requests don't hang forever
 * - Converts API data into a stable PhoneLens format
 * - Keeps the same exported function used by server.js
 */

const API_HOST = "libphonenumberapi.com";
const API_TIMEOUT = 10000;

/**
 * Make HTTPS GET request.
 */
function httpsGet(path) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      {
        hostname: API_HOST,
        path,
        headers: {
          "User-Agent": "PhoneLens/1.0",
          Accept: "application/json"
        }
      },
      (response) => {
        let body = "";

        response.setEncoding("utf8");

        response.on("data", (chunk) => {
          body += chunk;
        });

        response.on("end", () => {
          let data = null;

          try {
            data = JSON.parse(body);
          } catch (error) {
            return reject(
              new Error(
                `Invalid JSON response from API (HTTP ${response.statusCode})`
              )
            );
          }

          if (response.statusCode < 200 || response.statusCode >= 300) {
            return reject(
              new Error(
                data?.message ||
                data?.error ||
                `Phone API returned HTTP ${response.statusCode}`
              )
            );
          }

          resolve(data);
        });
      }
    );

    request.setTimeout(API_TIMEOUT, () => {
      request.destroy();
      reject(new Error("Phone API request timed out"));
    });

    request.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Normalize user input.
 */
function normalizePhoneNumber(phoneNumber) {
  let number = String(phoneNumber || "").trim();

  // Convert common Unicode plus sign to normal +
  number = number.replace(/＋/g, "+");

  // Keep only digits and +
  number = number.replace(/[^\d+]/g, "");

  // Only one + and it must be at the beginning
  if (number.includes("+")) {
    number =
      "+" +
      number
        .replace(/\+/g, "")
        .replace(/[^\d]/g, "");
  }

  // India:
  // 9876543210 -> +919876543210
  if (/^\d{10}$/.test(number)) {
    number = `+91${number}`;
  }

  return number;
}

/**
 * Convert API response into PhoneLens result items.
 */
function buildResults(data) {
  const results = [];

  function add(type, value) {
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      results.push({
        type,
        value: String(value)
      });
    }
  }

  // Validity
  if (typeof data.is_valid !== "undefined") {
    add(
      "validation",
      data.is_valid ? "Valid number" : "Invalid number"
    );
  }

  // Possible number
  if (typeof data.is_possible !== "undefined") {
    add(
      "possible",
      data.is_possible
        ? "Number format is possible"
        : "Number format is not possible"
    );
  }

  // Country
  add("country", data.country);

  // Country calling code
  if (data.components && data.components.country_code) {
    add("country code", `+${data.components.country_code}`);
  }

  // Carrier
  add("carrier", data.carrier);

  // Number type
  add("line type", data.type);

  // Geographic information
  add("location", data.geo_name);

  // Timezone
  add("timezone", data.timezone);

  // International format
  if (data.formats) {
    add("international format", data.formats.international);
  }

  // National format
  if (data.formats) {
    add("national format", data.formats.national);
  }

  // E.164 format
  if (data.formats) {
    add("E.164 format", data.formats.e164);
  }

  // Sanitized number
  add("sanitized number", data.sanitized);

  // Possible number types
  if (
    Array.isArray(data.possible_types) &&
    data.possible_types.length > 0
  ) {
    add(
      "possible types",
      data.possible_types.join(", ")
    );
  }

  return results;
}

/**
 * Main PhoneLens search function.
 */
async function searchPhoneNumber(phoneNumber) {
  const originalInput = String(phoneNumber || "").trim();

  if (!originalInput) {
    return {
      phoneNumber: "",
      results: [],
      message: "Phone number is required."
    };
  }

  const number = normalizePhoneNumber(originalInput);

  if (!number) {
    return {
      phoneNumber: originalInput,
      results: [],
      message: "Invalid phone number format."
    };
  }

  /*
   * The + sign must be URL encoded.
   * encodeURIComponent("+919876543210")
   * becomes %2B919876543210
   */
  const encodedNumber = encodeURIComponent(number);

  /*
   * Current documented endpoint:
   * /api/phone-numbers/{phone_number}
   */
  const path = `/api/phone-numbers/${encodedNumber}`;

  try {
    const data = await httpsGet(path);

    const results = buildResults(data);

    const finalPhoneNumber =
      data?.formats?.e164 ||
      data?.formats?.international ||
      number;

    return {
      phoneNumber: finalPhoneNumber,

      searchedNumber: originalInput,

      normalizedNumber: number,

      results,

      data: {
        valid:
          typeof data.is_valid !== "undefined"
            ? data.is_valid
            : null,

        possible:
          typeof data.is_possible !== "undefined"
            ? data.is_possible
            : null,

        country: data.country || null,

        countryCode:
          data?.components?.country_code || null,

        carrier: data.carrier || null,

        type: data.type || null,

        location: data.geo_name || null,

        timezone: data.timezone || null,

        formats: {
          e164: data?.formats?.e164 || null,
          international:
            data?.formats?.international || null,
          national:
            data?.formats?.national || null
        },

        possibleTypes:
          Array.isArray(data.possible_types)
            ? data.possible_types
            : []
      },

      message: "Phone number lookup completed successfully."
    };
  } catch (error) {
    console.error(
      "Phone API error:",
      error.message
    );

    /*
     * Important:
     * Don't crash the server if the external API
     * temporarily fails.
     */

    return {
      phoneNumber: number,

      searchedNumber: originalInput,

      normalizedNumber: number,

      results: [],

      data: {
        valid: null,
        possible: null,
        country: null,
        countryCode: null,
        carrier: null,
        type: null,
        location: null,
        timezone: null,
        formats: {
          e164: number,
          international: null,
          national: null
        },
        possibleTypes: []
      },

      message:
        "Phone number could not be looked up right now. Please try again."
    };
  }
}

module.exports = {
  searchPhoneNumber
};
