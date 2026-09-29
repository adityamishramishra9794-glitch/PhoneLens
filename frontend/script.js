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

function renderResults(data) {
  resultNumber.textContent = data.phoneNumber || "—";
  resultList.innerHTML = "";

  if (!Array.isArray(data.results) || data.results.length === 0) {
    const item = document.createElement("div");
    item.className = "result-item";

    item.innerHTML = `
      <div class="label">Result</div>
      <div class="value">No public results returned.</div>
    `;

    resultList.appendChild(item);
  } else {
    data.results.forEach((result) => {
      const item = document.createElement("div");
      item.className = "result-item";

      const label = document.createElement("div");
      label.className = "label";
      label.textContent = result.type || "Information";

      const value = document.createElement("div");
      value.className = "value";
      value.textContent = result.value || "";

      item.appendChild(label);
      item.appendChild(value);

      resultList.appendChild(item);
    });
  }

  resultSection.classList.remove("hidden");
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

  const digits = phone.replace(/[^\d+]/g, "");

  if (digits.length < 7) {
    showError("Please enter a valid phone number.");
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(
      `${API_URL}/api/search?phone=${encodeURIComponent(digits)}`
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Search failed.");
    }

    renderResults(data);

  } catch (error) {
    console.error(error);

    showError(
      "Unable to connect to PhoneLens API. Please try again."
    );
  } finally {
    setLoading(false);
  }
});
