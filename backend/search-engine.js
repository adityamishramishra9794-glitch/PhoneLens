async function searchPublicWeb(phoneNumber, normalized) {
  if (!TAVILY_API_KEY) {
    console.error("TAVILY_API_KEY is not configured.");

    return {
      enabled: false,
      results: []
    };
  }

  const originalDigits = String(phoneNumber || "")
    .replace(/\D/g, "");

  const normalizedDigits = String(normalized || "")
    .replace(/\D/g, "");

  if (!originalDigits && !normalizedDigits) {
    return {
      enabled: true,
      results: []
    };
  }

  // Search using exact phone-number forms.
  const searchVariants = [];

  if (originalDigits) {
    searchVariants.push(`"${originalDigits}"`);
  }

  if (
    normalizedDigits &&
    normalizedDigits !== originalDigits
  ) {
    searchVariants.push(`"${normalizedDigits}"`);
  }

  // For Indian numbers, also search common formatted forms.
  if (originalDigits.length === 10) {
    const formatted =
      `${originalDigits.slice(0, 5)} ${originalDigits.slice(5)}`;

    searchVariants.push(`"${formatted}"`);

    searchVariants.push(
      `"+91 ${formatted}"`
    );
  }

  const query =
    searchVariants.join(" OR ");

  try {
    const body = JSON.stringify({
      query,

      search_depth: "advanced",

      topic: "general",

      max_results: 10,

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

    const rawResults =
      Array.isArray(response.results)
        ? response.results
        : [];

    /*
     * STRICT RELEVANCE FILTER
     *
     * Tavily can return semantically related pages
     * even when the exact number is not present.
     *
     * We only keep pages where the searched phone
     * number actually appears in the returned text.
     */

    const matchDigits = (value) => {
      return String(value || "")
        .replace(/\D/g, "");
    };

    const results = rawResults
      .map((item) => {
        const title =
          item.title || "";

        const url =
          item.url || "";

        const content =
          item.content ||
          item.snippet ||
          "";

        const combined =
          `${title} ${url} ${content}`;

        const combinedDigits =
          matchDigits(combined);

        const originalMatch =
          originalDigits.length >= 7 &&
          combinedDigits.includes(originalDigits);

        const normalizedMatch =
          normalizedDigits.length >= 7 &&
          combinedDigits.includes(normalizedDigits);

        return {
          title,
          url,
          snippet: content,
          score:
            typeof item.score === "number"
              ? item.score
              : null,
          exactMatch:
            originalMatch ||
            normalizedMatch
        };
      })
      .filter(item => item.exactMatch)
      .slice(0, 8)
      .map(item => ({
        title:
          item.title ||
          "Public Web Result",

        url:
          item.url || "",

        snippet:
          item.snippet || "",

        score:
          item.score
      }));

    return {
      enabled: true,

      results,

      searchedQueries:
        searchVariants
    };

  } catch (error) {
    console.error(
      "Tavily search error:",
      error.message
    );

    return {
      enabled: true,

      results: [],

      error:
        "Public web search temporarily unavailable."
    };
  }
      }
