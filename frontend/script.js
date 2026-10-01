const API_BASE = "https://phonelens-2.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
  const input =
    document.querySelector("#phoneInput") ||
    document.querySelector("#phone") ||
    document.querySelector('input[type="tel"]') ||
    document.querySelector('input[type="text"]');

  const button =
    document.querySelector("#searchButton") ||
    document.querySelector("#searchBtn") ||
    [...document.querySelectorAll("button")].find(btn =>
      btn.textContent.trim().toLowerCase().includes("search number")
    );

  if (!input || !button) {
    console.error("PhoneLens: input or search button not found.");
    return;
  }

  /*
   * Find the ORIGINAL result area.
   * We intentionally support multiple possible IDs/classes.
   */
  let resultsContainer =
    document.querySelector("#results") ||
    document.querySelector("#result") ||
    document.querySelector("#lookupResult") ||
    document.querySelector("#searchResult") ||
    document.querySelector(".results") ||
    document.querySelector(".result");

  /*
   * If the existing HTML doesn't have a result container,
   * create one after the search area.
   */
  if (!resultsContainer) {
    resultsContainer = document.createElement("div");
    resultsContainer.id = "results";

    const parent =
      button.closest("section") ||
      button.closest("main") ||
      button.parentElement;

    if (parent) {
      parent.appendChild(resultsContainer);
    } else {
      document.body.appendChild(resultsContainer);
    }
  }

  button.addEventListener("click", searchNumber);

  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchNumber();
    }
  });

  async function searchNumber() {
    const phone = input.value.trim();

    if (!phone) {
      showError("Please enter a phone number.");
      return;
    }

    button.disabled = true;
    button.textContent = "Searching...";

    resultsContainer.innerHTML = `
      <div class="pl-loading">
        <div class="pl-spinner"></div>
        <strong>Searching PhoneLens...</strong>
        <small>
          Checking phone metadata and public web results
        </small>
      </div>
    `;

    try {
      const url =
        `${API_BASE}/api/search?phone=${encodeURIComponent(phone)}`;

      console.log("PhoneLens API:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      });

      const rawText = await response.text();

      console.log("PhoneLens HTTP status:", response.status);
      console.log("PhoneLens raw response:", rawText);

      let data;

      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(
          "API returned an invalid response. Check the backend."
        );
      }

      console.log("PhoneLens parsed response:", data);

      if (!response.ok) {
        throw new Error(
          data.error ||
          `API request failed (${response.status})`
        );
      }

      if (data.success !== true) {
        throw new Error(
          data.error ||
          "PhoneLens search failed."
        );
      }

      renderResults(data);

    } catch (error) {
      console.error("PhoneLens search error:", error);

      showError(
        error.message ||
        "Unable to connect to PhoneLens API."
      );
    } finally {
      button.disabled = false;
      button.textContent = "Search Number";
    }
  }

  function renderResults(response) {
    /*
     * Backend structure:
     *
     * {
     *   success: true,
     *   phoneNumber: "...",
     *   searchedNumber: "...",
     *   normalizedNumber: "...",
     *   results: [],
     *   data: {},
     *   publicWeb: {}
     * }
     */

    const info =
      response.data &&
      typeof response.data === "object"
        ? response.data
        : {};

    const components =
      info.components &&
      typeof info.components === "object"
        ? info.components
        : {};

    const formats =
      info.formats &&
      typeof info.formats === "object"
        ? info.formats
        : {};

    const publicWeb =
      response.publicWeb &&
      typeof response.publicWeb === "object"
        ? response.publicWeb
        : {};

    /*
     * IMPORTANT:
     * Backend definitely returns phoneNumber.
     */
    const displayedPhone =
      response.phoneNumber ||
      response.normalizedNumber ||
      response.searchedNumber ||
      "-";

    resultsContainer.innerHTML = `
      <div class="pl-result-wrapper">

        <div class="pl-result-header">
          <div>
            <div class="pl-small-title">
              SEARCH RESULT
            </div>

            <h2>
              Lookup Result
            </h2>
          </div>

          <div class="pl-checked">
            ✓ Checked
          </div>
        </div>

        <div class="pl-phone-card">
          <span>PHONE NUMBER</span>

          <strong>
            ${escapeHTML(displayedPhone)}
          </strong>
        </div>

        <div class="pl-grid">

          ${card(
            "VALIDITY",
            info.valid === true
              ? "Valid number"
              : info.valid === false
                ? "Invalid number"
                : "Unknown"
          )}

          ${card(
            "POSSIBLE",
            info.possible === true
              ? "Number format is possible"
              : info.possible === false
                ? "Number format is not possible"
                : "Unknown"
          )}

          ${card("COUNTRY", info.country)}

          ${card(
            "COUNTRY CODE",
            info.countryCode
              ? `+${info.countryCode}`
              : null
          )}

          ${card(
            "CARRIER",
            info.carrier
          )}

          ${card(
            "LINE TYPE",
            info.type
          )}

          ${card(
            "GEOGRAPHIC REGION",
            info.location
          )}

          ${card(
            "TIMEZONE",
            info.timezone
          )}

          ${card(
            "AREA CODE",
            components.areaCode
          )}

          ${card(
            "LOCAL NUMBER",
            components.localNumber
          )}

          ${card(
            "EXTENSION",
            components.extension
          )}

          ${card(
            "INTERNATIONAL FORMAT",
            formats.international
          )}

          ${card(
            "NATIONAL FORMAT",
            formats.national
          )}

          ${card(
            "E.164 FORMAT",
            formats.e164
          )}

          ${card(
            "SANITIZED NUMBER",
            info.sanitized
          )}

          ${card(
            "POSSIBLE NUMBER TYPES",
            Array.isArray(info.possibleTypes)
              ? info.possibleTypes.join(", ")
              : null
          )}

        </div>

        ${renderPublicWeb(publicWeb)}

        <div class="pl-privacy">
          <strong>
            Privacy notice
          </strong>

          <p>
            PhoneLens displays information returned by
            its configured public-data services. It does not
            provide private account credentials, OTPs,
            passwords, or live private location data.
          </p>
        </div>

      </div>
    `;

    injectStyles();
  }

  function renderPublicWeb(publicWeb) {
    const webResults =
      Array.isArray(publicWeb.results)
        ? publicWeb.results
        : [];

    if (webResults.length === 0) {
      return `
        <section class="pl-web-section">

          <div class="pl-web-header">

            <div>
              <div class="pl-small-title">
                PUBLIC WEB
              </div>

              <h2>
                Public Web Results
              </h2>
            </div>

          </div>

          <div class="pl-no-results">
            No public web results were found.
          </div>

        </section>
      `;
    }

    return `
      <section class="pl-web-section">

        <div class="pl-web-header">

          <div>
            <div class="pl-small-title">
              TAVILY SEARCH
            </div>

            <h2>
              Public Web Results
            </h2>
          </div>

          <div class="pl-result-count">
            ${webResults.length} results
          </div>

        </div>

        <div class="pl-web-list">

          ${webResults.map((item, index) => {

            const title =
              item.title ||
              "Public Web Result";

            const url =
              item.url ||
              "";

            const snippet =
              item.snippet ||
              "No description available.";

            const score =
              typeof item.score === "number"
                ? Math.round(item.score * 100)
                : null;

            let domain = "";

            try {
              domain = url
                ? new URL(url).hostname
                : "";
            } catch {
              domain = url;
            }

            return `
              <article class="pl-web-card">

                <div class="pl-web-number">
                  ${index + 1}
                </div>

                <div class="pl-web-content">

                  <h3>
                    ${escapeHTML(title)}
                  </h3>

                  <div class="pl-domain">
                    ${escapeHTML(domain)}
                  </div>

                  <p>
                    ${escapeHTML(snippet)}
                  </p>

                  <div class="pl-web-bottom">

                    ${
                      score !== null
                        ? `
                          <span class="pl-score">
                            Relevance ${score}%
                          </span>
                        `
                        : ""
                    }

                    ${
                      url
                        ? `
                          <a
                            href="${escapeAttribute(url)}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="pl-open-btn"
                          >
                            Open Result ↗
                          </a>
                        `
                        : ""
                    }

                  </div>

                </div>

              </article>
            `;
          }).join("")}

        </div>

      </section>
    `;
  }

  function card(label, value) {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ""
    ) {
      return "";
    }

    return `
      <div class="pl-info-card">

        <span>
          ${escapeHTML(label)}
        </span>

        <strong>
          ${escapeHTML(String(value))}
        </strong>

      </div>
    `;
  }

  function showError(message) {
    resultsContainer.innerHTML = `
      <div class="pl-error">

        <strong>
          Search failed
        </strong>

        <p>
          ${escapeHTML(message)}
        </p>

      </div>
    `;

    injectStyles();
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHTML(value);
  }

  function injectStyles() {
    if (
      document.querySelector("#phonelens-web-styles")
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "phonelens-web-styles";

    style.textContent = `
      .pl-result-wrapper {
        width: 100%;
      }

      .pl-result-header,
      .pl-web-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 15px;
        margin-bottom: 20px;
      }

      .pl-small-title {
        font-size: 12px;
        letter-spacing: 2px;
        font-weight: 700;
        opacity: .6;
        margin-bottom: 6px;
      }

      .pl-result-header h2,
      .pl-web-header h2 {
        margin: 0;
      }

      .pl-checked {
        color: #62e6a7;
        font-weight: 700;
        white-space: nowrap;
      }

      .pl-phone-card,
      .pl-info-card,
      .pl-web-card,
      .pl-privacy,
      .pl-no-results,
      .pl-error {
        box-sizing: border-box;
        border-radius: 20px;
        margin-bottom: 16px;
      }

      .pl-phone-card {
        padding: 25px;
        background: rgba(8, 13, 28, .9);
        border: 1px solid rgba(255,255,255,.08);
      }

      .pl-phone-card span,
      .pl-info-card span {
        display: block;
        font-size: 12px;
        letter-spacing: 1.5px;
        opacity: .55;
        margin-bottom: 8px;
      }

      .pl-phone-card strong {
        display: block;
        font-size: 25px;
        word-break: break-word;
      }

      .pl-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .pl-info-card {
        padding: 20px;
        background: rgba(18, 31, 66, .75);
        border: 1px solid rgba(75, 125, 255, .18);
      }

      .pl-info-card strong {
        font-size: 17px;
        word-break: break-word;
      }

      .pl-web-section {
        margin-top: 35px;
      }

      .pl-result-count {
        padding: 7px 12px;
        border-radius: 20px;
        background: rgba(100, 90, 255, .15);
        font-size: 13px;
        white-space: nowrap;
      }

      .pl-web-list {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .pl-web-card {
        display: flex;
        gap: 15px;
        padding: 20px;
        background: rgba(8, 13, 28, .95);
        border: 1px solid rgba(255,255,255,.08);
      }

      .pl-web-number {
        min-width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(95, 80, 255, .2);
        font-weight: 700;
      }

      .pl-web-content {
        min-width: 0;
        flex: 1;
      }

      .pl-web-content h3 {
        margin: 0 0 6px;
        font-size: 17px;
        line-height: 1.35;
      }

      .pl-domain {
        font-size: 12px;
        opacity: .55;
        margin-bottom: 10px;
        word-break: break-all;
      }

      .pl-web-content p {
        margin: 0 0 15px;
        opacity: .78;
        line-height: 1.5;
        font-size: 14px;
      }

      .pl-web-bottom {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .pl-score {
        font-size: 12px;
        opacity: .7;
      }

      .pl-open-btn {
        display: inline-block;
        padding: 9px 14px;
        border-radius: 10px;
        text-decoration: none;
        background: linear-gradient(
          90deg,
          #315ff5,
          #7b3ff2
        );
        color: white;
        font-size: 13px;
        font-weight: 700;
      }

      .pl-open-btn:hover {
        opacity: .9;
      }

      .pl-privacy {
        margin-top: 25px;
        padding: 18px;
        background: rgba(80, 55, 10, .2);
        border: 1px solid rgba(220, 170, 40, .2);
      }

      .pl-privacy strong {
        color: #ffd43b;
      }

      .pl-privacy p {
        margin-bottom: 0;
        opacity: .7;
        line-height: 1.5;
      }

      .pl-no-results,
      .pl-error {
        padding: 22px;
        background: rgba(8, 13, 28, .9);
        border: 1px solid rgba(255,255,255,.08);
      }

      .pl-error {
        border-color: rgba(255, 70, 70, .3);
      }

      .pl-loading {
        padding: 35px 20px;
        text-align: center;
        background: rgba(8, 13, 28, .9);
        border-radius: 20px;
      }

      .pl-loading small {
        display: block;
        margin-top: 8px;
        opacity: .55;
      }

      .pl-spinner {
        width: 28px;
        height: 28px;
        margin: 0 auto 15px;
        border: 3px solid rgba(255,255,255,.15);
        border-top-color: white;
        border-radius: 50%;
        animation: pl-spin .8s linear infinite;
      }

      @keyframes pl-spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 600px) {

        .pl-grid {
          grid-template-columns: 1fr;
        }

        .pl-result-header,
        .pl-web-header {
          align-items: flex-start;
        }

        .pl-web-card {
          padding: 16px;
        }

        .pl-phone-card strong {
          font-size: 21px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  injectStyles();
});
