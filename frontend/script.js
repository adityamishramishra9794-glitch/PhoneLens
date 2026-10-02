const API_BASE = "https://phonelens-2.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("searchForm");
  const input = document.getElementById("phoneInput");
  const clearBtn = document.getElementById("clearBtn");

  const buttonText = document.getElementById("buttonText");
  const loader = document.getElementById("loader");

  const errorBox = document.getElementById("error");

  const resultSection = document.getElementById("resultSection");
  const resultNumber = document.getElementById("resultNumber");
  const resultList = document.getElementById("resultList");

  if (
    !form ||
    !input ||
    !buttonText ||
    !loader ||
    !errorBox ||
    !resultSection ||
    !resultNumber ||
    !resultList
  ) {
    console.error("PhoneLens: Required HTML elements were not found.");
    return;
  }

  /*
   * Clear button
   */
  clearBtn?.addEventListener("click", () => {
    input.value = "";
    input.focus();

    errorBox.textContent = "";
    errorBox.classList.add("hidden");

    resultSection.classList.add("hidden");
    resultList.innerHTML = "";
    resultNumber.textContent = "—";
  });

  /*
   * Search form
   */
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const phone = input.value.trim();

    if (!phone) {
      showError("Please enter a phone number.");
      return;
    }

    hideError();
    setLoading(true);

    resultSection.classList.add("hidden");
    resultList.innerHTML = "";
    resultNumber.textContent = "—";

    try {
      const url = `${API_BASE}/api/search?phone=${encodeURIComponent(phone)}`;

      console.log("PhoneLens request:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      });

      const text = await response.text();

      console.log("PhoneLens response status:", response.status);
      console.log("PhoneLens raw response:", text);

      let data;

      try {
        data = JSON.parse(text);
      } catch (jsonError) {
        throw new Error("PhoneLens API returned an invalid response.");
      }

      console.log("PhoneLens parsed data:", data);

      if (!response.ok) {
        throw new Error(
          data.error || `API request failed (${response.status})`
        );
      }

      if (data.success !== true) {
        throw new Error(data.error || "PhoneLens search failed.");
      }

      renderResult(data);
    } catch (error) {
      console.error("PhoneLens search error:", error);

      showError(error.message || "Unable to connect to PhoneLens API.");
    } finally {
      setLoading(false);
    }
  });

  /*
   * Loading state
   */
  function setLoading(isLoading) {
    const searchButton = form.querySelector(".search-btn");

    if (searchButton) {
      searchButton.disabled = isLoading;
    }

    if (isLoading) {
      buttonText.textContent = "Searching...";
      loader.classList.remove("hidden");
    } else {
      buttonText.textContent = "Search Number";
      loader.classList.add("hidden");
    }
  }

  /*
   * Render complete API result
   */
  function renderResult(data) {
    const info =
      data.data && typeof data.data === "object" ? data.data : {};

    const components =
      info.components && typeof info.components === "object"
        ? info.components
        : {};

    const formats =
      info.formats && typeof info.formats === "object" ? info.formats : {};

    const telecomCircle =
      info.telecomCircle && typeof info.telecomCircle === "object"
        ? info.telecomCircle
        : {};

    /*
     * Backend returns:
     * phoneNumber, searchedNumber, normalizedNumber
     */
    const phoneNumber =
      data.phoneNumber ||
      data.normalizedNumber ||
      data.searchedNumber ||
      "—";

    resultNumber.textContent = phoneNumber;

    /*
     * Build information cards
     */
    let html = "";

    html += card(
      "VALIDITY",
      info.valid === true
        ? "Valid number"
        : info.valid === false
          ? "Invalid number"
          : "Unknown"
    );

    html += card(
      "POSSIBLE",
      info.possible === true
        ? "Number format is possible"
        : info.possible === false
          ? "Number format is not possible"
          : "Unknown"
    );

    html += card("COUNTRY", info.country);

    html += card(
      "COUNTRY CODE",
      info.countryCode ? `+${info.countryCode}` : null
    );

    html += card("CARRIER", info.carrier);

    html += card("LINE TYPE", info.type);

    html += card("GEOGRAPHIC REGION", info.location);

    /* Telecom circle (e.g. UP East) + original operator */
    html += card("TELECOM CIRCLE", telecomCircle.circle);

    html += card("ORIGINAL OPERATOR", telecomCircle.operator);

    html += card("TIMEZONE", info.timezone);

    html += card("AREA CODE", components.areaCode);

    html += card("LOCAL NUMBER", components.localNumber);

    html += card("EXTENSION", components.extension);

    html += card("INTERNATIONAL FORMAT", formats.international);

    html += card("NATIONAL FORMAT", formats.national);

    html += card("E.164 FORMAT", formats.e164);

    html += card("SANITIZED NUMBER", info.sanitized);

    if (Array.isArray(info.possibleTypes) && info.possibleTypes.length) {
      html += card("POSSIBLE NUMBER TYPES", info.possibleTypes.join(", "));
    }

    /*
     * Public web results
     */
    html += renderPublicWeb(data.publicWeb);

    resultList.innerHTML = html;

    resultSection.classList.remove("hidden");

    resultSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  /*
   * Information card
   */
  function card(label, value) {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ""
    ) {
      return "";
    }

    return `
      <div class="info-card">
        <span>${escapeHTML(label)}</span>
        <strong>${escapeHTML(String(value))}</strong>
      </div>
    `;
  }

  /*
   * Public web / Tavily results
   */
  function renderPublicWeb(publicWeb) {
    if (
      !publicWeb ||
      !Array.isArray(publicWeb.results) ||
      publicWeb.results.length === 0
    ) {
      return `
        <div class="web-results">
          <div class="web-heading">
            <span class="small-title">PUBLIC WEB</span>
            <h3>Public Web Results</h3>
          </div>

          <div class="web-empty">
            No public web results were found.
          </div>
        </div>
      `;
    }

    const results = publicWeb.results;

    return `
      <div class="web-results">

        <div class="web-heading">
          <span class="small-title">TAVILY SEARCH</span>
          <h3>Public Web Results</h3>
          <span class="web-count">${results.length} results</span>
        </div>

        <div class="web-list">

          ${results
            .map((item, index) => {
              const title = item.title || "Public Web Result";

              const url = item.url || "";

              const snippet = item.snippet || "No description available.";

              const score =
                typeof item.score === "number"
                  ? Math.round(item.score * 100)
                  : null;

              let domain = "";

              try {
                domain = url ? new URL(url).hostname : "";
              } catch {
                domain = url;
              }

              return `
              <article class="web-card">

                <div class="web-index">${index + 1}</div>

                <div class="web-content">

                  <h4>${escapeHTML(title)}</h4>

                  <div class="web-domain">${escapeHTML(domain)}</div>

                  <p>${escapeHTML(snippet)}</p>

                  <div class="web-bottom">

                    ${
                      score !== null
                        ? `<span class="web-score">Relevance ${score}%</span>`
                        : ""
                    }

                    ${
                      url
                        ? `<a
                            href="${escapeAttribute(url)}"
                            target="_blank"
                            rel="noopener noreferrer"
                          >Open Result ↗</a>`
                        : ""
                    }

                  </div>

                </div>

              </article>
            `;
            })
            .join("")}

        </div>

      </div>
    `;
  }

  /*
   * Error
   */
  function showError(message) {
    errorBox.textContent = message || "Something went wrong.";
    errorBox.classList.remove("hidden");
  }

  function hideError() {
    errorBox.textContent = "";
    errorBox.classList.add("hidden");
  }

  /*
   * Safe HTML output
   */
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
});
      
