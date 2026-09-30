const https = require("https");

function searchPhoneNumber(phoneNumber) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.NUMVERIFY_API_KEY;

    if (!apiKey) {
      return reject(new Error("NUMVERIFY_API_KEY is not configured"));
    }

    let number = String(phoneNumber || "").trim();

    // Keep digits and leading +
    number = number.replace(/[^\d+]/g, "");

    // Treat 10-digit numbers as Indian numbers
    if (/^\d{10}$/.test(number)) {
      number = `+91${number}`;
    }

    const query = encodeURIComponent(number);

    const url =
      `https://apilayer.net/api/validate?access_key=${encodeURIComponent(apiKey)}` +
      `&number=${query}&country_code=IN&format=1`;

    https.get(url, (response) => {
      let body = "";

      response.on("data", (chunk) => {
        body += chunk;
      });

      response.on("end", () => {
        try {
          const data = JSON.parse(body);

          if (data.error) {
            return reject(
              new Error(data.error.info || "Numverify API error")
            );
          }

          const results = [];

          if (typeof data.valid !== "undefined") {
            results.push({
              type: "validation",
              value: data.valid ? "Valid number" : "Invalid number"
            });
          }

          if (data.international_format) {
            results.push({
              type: "international format",
              value: data.international_format
            });
          }

          if (data.local_format) {
            results.push({
              type: "national format",
              value: data.local_format
            });
          }

          if (data.country_name) {
            results.push({
              type: "country",
              value: data.country_name
            });
          }

          if (data.country_code) {
            results.push({
              type: "country code",
              value: data.country_code
            });
          }

          if (data.carrier) {
            results.push({
              type: "carrier",
              value: data.carrier
            });
          }

          if (data.line_type) {
            results.push({
              type: "line type",
              value: data.line_type
            });
          }

          resolve({
            phoneNumber: data.international_format || number,
            results,
            message: "Numverify lookup completed."
          });
        } catch (error) {
          reject(new Error("Invalid response from Numverify"));
        }
      });
    }).on("error", (error) => {
      reject(error);
    });
  });
}

module.exports = {
  searchPhoneNumber
};
