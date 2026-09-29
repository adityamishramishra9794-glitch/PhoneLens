const express = require("express");
const cors = require("cors");

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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PhoneLens API running on port ${PORT}`);
});
