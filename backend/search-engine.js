const https = require("https");

function searchPhoneNumber(phoneNumber) {
  return new Promise((resolve, reject) => {
    let number = String(phoneNumber || "").trim();

    // Keep digits and leading +
    number = number.replace(/[^\d+]/g, "");

    if (!number) {
      return resolve({
        phoneNumber: "",
        results: [],
        message: "Invalid phone number"
      });
    }

    // India: automatically add +91 for a 10-digit number
    if (/^\d{10}$/.test(number)) {
      number = `+91${number}`;
    }

    const encodedNumber = encodeURIComponent(number);

    const url =
      `https://libphonenumberapi.com/api/parse?number=${encodedNumber}`;

    https.get(
      url,
      {
        headers: {
          "User-Agent": "PhoneLens/1.0"
        }
      },
      (response) => {
        let body = "";

        response.on("data", (chunk) => {
          body += chunk;
        });

        response.on("end", () => {
          try {
            const data = JSON.parse(body);

            if (response.statusCode < 200 || response.statusCode >= 300) {
              return reject(
                new Error(
                  data.message ||
                  data.error ||
                  `API returned HTTP ${response.statusCode}`
                )
              );
            }

            const results = [];

            // Validity
            if (typeof data.valid !== "undefined") {
              results.push({
                type: "validation",
                value: data.valid ? "Valid number" : "Invalid number"
              });
            }

            // International format
            if (data.international_format) {
              results.push({
                type: "international format",
                value: data.international_format
              });
            }

            // National/local format
            if (data.national_format) {
              results.push({
                type: "national format",
                value: data.national_format
              });
            }

            // Country
            if (data.country) {
              results.push({
                type: "country",
                value: data.country
              });
            }

            if (data.country_code) {
              results.push({
                type: "country code",
                value: data.country_code
              });
            }

            // Carrier
            if (data.carrier) {
              results.push({
                type: "carrier",
                value: data.carrier
              });
            }

            // Line type
            if (data.line_type) {
              results.push({
                type: "line type",
                value: data.line_type
              });
            }

            resolve({
              phoneNumber:
                data.international_format ||
                data.formatted ||
                number,

              results,

              message: "Phone number lookup completed."
            });

          } catch (error) {
            reject(
              new Error("Invalid response received from phone API")
            );
          }
        });
      }
    ).on("error", (error) => {
      reject(error);
    });
  });
}

module.exports = {
  searchPhoneNumber
};
