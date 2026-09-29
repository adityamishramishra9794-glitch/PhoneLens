const express = require("express");
const cors = require("cors");
const { searchPhoneNumber } = require("./search-engine");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "PhoneLens API",
    status: "online"
  });
});

app.get("/healthz", (req, res) => {
  res.json({
    success: true,
    status: "healthy"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "online"
  });
});

app.get("/api/search", async (req, res) => {
  try {
    const phoneNumber = String(req.query.phone || "").trim();

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: "Phone number is required",
        example: "/api/search?phone=9876543210"
      });
    }

    const result = await searchPhoneNumber(phoneNumber);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("Search error:", error);

    res.status(500).json({
      success: false,
      error: "Search failed"
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PhoneLens API running on port ${PORT}`);
});
