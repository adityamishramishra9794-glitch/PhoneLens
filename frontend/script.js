const API_URL = "https://phonelens-2.onrender.com";

const searchForm = document.getElementById("searchForm");
const phoneInput = document.getElementById("phoneInput");
const clearBtn = document.getElementById("clearBtn");

const resultSection = document.getElementById("resultSection");
const resultNumber = document.getElementById("resultNumber");
const resultList = document.getElementById("resultList");

const errorBox = document.getElementById("error");
const buttonText = document.getElementById("buttonText");
const loader = document.getElementById("loader");
const searchButton = document.querySelector(".search-btn");

clearBtn.addEventListener("click", () => {
  phoneInput.value = "";
  phoneInput.focus();

  resultSection.classList.add("hidden");
  errorBox.classList.add("hidden");
});

function setLoading(loading) {
  searchButton.disabled = loading;

  if (loading) {
    buttonText.classList.add("hidden");
    loader.classList.remove("hidden");
  } else {
    buttonText.classList.remove("hidden");
    loader.classList.add("hidden");
  }
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function createResultItem(label, value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const item = document.createElement("div");
  item.className = "result-item";

  const labelElement = document.createElement("div");
  labelElement.className = "label";
  labelElement.textContent = label;

  const valueElement = document.createElement("div");
  valueElement.className = "value";
  valueElement.textContent = String(value);

  item.appendChild(labelElement);
  item.appendChild(valueElement);

  return item;
}

function renderResults(data) {
  resultNumber.textContent = data.phoneNumber || "—";
  resultList.innerHTML = "";

  const phoneData = data.data || {};

  const fields = [
    [
      "Validity",
      phoneData.valid === true
        ? "Valid number"
        : phoneData.valid === false
          ? "Invalid number"
          : null
    ],

    [
      "Possible",
      phoneData.possible === true
        ? "Number format is possible"
        : phoneData.possible === false
          ? "Number format is not possible"
          : null
    ],

    ["Country", phoneData.country],

    [
      "Country Code",
      phoneData.countryCode
        ? `+${phoneData.countryCode}`
        : null
    ],

    ["Carrier", phoneData.carrier],

    ["Line Type", phoneData.type],

    ["Geographic Region", phoneData.location],

    ["Timezone", phoneData.timezone],

    [
      "Area Code",
      phoneData.components?.areaCode
    ],

    [
      "Local Number",
      phoneData.components?.localNumber
    ],

    [
      "Extension",
      phoneData.components?.extension
    ],

    [
      "International Format",
      phoneData.formats?.international
    ],

    [
      "National Format",
      phoneData.formats?.national
    ],

    [
      "E.164 Format",
      phoneData.formats?.e164
    ],

    [
      "Sanitized Number",
      phoneData.sanitized
    ],

    [
      "Possible Number Types",
      Array.isArray(phoneData.possibleTypes)
        ? phoneData.possibleTypes.join(", ")
        : null
    ]
  ];

  fields.forEach(([label, value]) => {
    const item = createResultItem(label, value);

    if (item) {
      resultList.appendChild(item);
    }
  });

  /*
   * Public Web Search
   */
  const publicWeb = data.publicWeb;

  if (
    publicWeb &&
    Array.isArray(publicWeb.searches) &&
    publicWeb.searches.length > 0
  ) {
    const section = document.createElement("div");
    section.className = "result-item";

    const title = document.createElement("div");
    title.className = "label";
    title.textContent = "PUBLIC WEB SEARCH";

    section.appendChild(title);

    const note = document.createElement("div");
    note.className = "value";
    note.textContent =
      "Search publicly indexed webpages for this number.";

    note.style.marginBottom = "12px";

    section.appendChild(note);

    publicWeb.searches.forEach((search) => {
      const link = document.createElement("a");

      link.href = search.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      link.textContent =
        `Open ${search.engine} Search`;

      link.style.display = "block";
      link.style.marginTop = "8px";
      link.style.color = "#93c5fd";
      link.style.textDecoration = "none";
      link.style.fontWeight = "600";

      section.appendChild(link);
    });

    resultList.appendChild(section);
  }

  /*
   * Fallback for old API response
   */
  if (
    resultList.children.length === 0 &&
    Array.isArray(data.results)
  ) {
    data.results.forEach((result) => {
      const item = createResultItem(
        result.type || "Information",
        result.value || ""
      );

      if (item) {
        resultList.appendChild(item);
      }
    });
  }

  /*
   * Nothing found
   */
  if (resultList.children.length === 0) {
    const item = createResultItem(
      "Result",
      "No public information returned."
    );

    if (item) {
      resultList.appendChild(item);
    }
  }

  resultSection.classList.remove("hidden");

  setTimeout(() => {
    resultSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, 100);
}

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  errorBox.classList.add("hidden");
  resultSection.classList.add("hidden");

  const phone = phoneInput.value.trim();

  if (!phone) {
    showError("Please enter a phone number.");
    return;
  }

  let cleaned = phone.replace(/[^\d+]/g, "");

  if (cleaned.includes("+")) {
    cleaned =
      "+" +
      cleaned
        .replace(/\+/g, "")
        .replace(/\D/g, "");
  }

  const digitsOnly = cleaned.replace(/\D/g, "");

  if (digitsOnly.length < 7) {
    showError("Please enter a valid phone number.");
    return;
  }

  setLoading(true);

  try {
    const url =
      `${API_URL}/api/search?phone=${encodeURIComponent(cleaned)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Invalid response from PhoneLens API."
      );
    }

    if (!response.ok || !data.success) {
      throw new Error(
        data.error ||
        data.message ||
        "PhoneLens search failed."
      );
    }

    renderResults(data);

  } catch (error) {
    console.error("PhoneLens error:", error);

    showError(
      "Unable to connect to PhoneLens API. Please try again."
    );
  } finally {
    setLoading(false);
  }
});
