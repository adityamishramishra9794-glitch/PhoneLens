// PhoneLens backend (koi extra package nahi chahiye, sirf Node ka built-in http)
// Routes:
//   GET /                      -> status
//   GET /health                -> health check
//   GET /api/search?phone=...  -> phone lookup
//   GET /api/username?name=... -> username public profile check

const http = require("http");
const { searchPhoneNumber } = require("./search-engine");
const { searchUsername } = require("./usernameSearch");

const PORT = process.env.PORT || 3000;

function sendJSON(res, status, payload) {
  const body = JSON.stringify(payload);

  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept"
  });

  res.end(body);
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return sendJSON(res, 204, {});
  }

  let url;

  try {
    url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  } catch {
    return sendJSON(res, 400, { success: false, error: "Bad request" });
  }

  if (req.method !== "GET") {
    return sendJSON(res, 405, {
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    // Status
    if (url.pathname === "/" || url.pathname === "/health") {
      return sendJSON(res, 200, {
        success: true,
        service: "PhoneLens API",
        status: "online"
      });
    }

    // Phone search
    if (url.pathname === "/api/search") {
      const phone = (url.searchParams.get("phone") || "").trim();

      if (!phone) {
        return sendJSON(res, 400, {
          success: false,
          error: "Phone number is required"
        });
      }

      const result = await searchPhoneNumber(phone);

      return sendJSON(res, 200, { success: true, ...result });
    }

    // Username search
    if (url.pathname === "/api/username") {
      const name = (url.searchParams.get("name") || "").trim();

      if (!name) {
        return sendJSON(res, 400, {
          success: false,
          error: "Username is required"
        });
      }

      const result = await searchUsername(name);

      return sendJSON(res, 200, { success: true, ...result });
    }

    return sendJSON(res, 404, { success: false, error: "Not found" });
  } catch (error) {
    console.error("Server error:", error.message);

    const isInputError =
      /required|valid username/i.test(error.message || "");

    return sendJSON(res, isInputError ? 400 : 500, {
      success: false,
      error: error.message || "Internal server error"
    });
  }
});

server.listen(PORT, () => {
  console.log(`PhoneLens API running on port ${PORT}`);
});
                      
