// India mobile series lookup (pehle 4 digits -> original operator + circle)
// Data files: series9a.js, series9b.js, series8.js, series7.js, series6.js
// Sab files ek hi folder me honi chahiye.

const OPERATORS = {
  AT: "Airtel",
  CG: "BSNL/MTNL",
  RJ: "Reliance Jio",
  VI: "Vodafone Idea"
};

const CIRCLES = {
  AP: "Andhra Pradesh & Telangana",
  AS: "Assam",
  BR: "Bihar & Jharkhand",
  CH: "Chennai",
  DL: "Delhi",
  GJ: "Gujarat",
  HP: "Himachal Pradesh",
  HR: "Haryana",
  JK: "Jammu & Kashmir",
  KL: "Kerala",
  KA: "Karnataka",
  KO: "Kolkata",
  MH: "Maharashtra & Goa",
  MP: "Madhya Pradesh & Chhattisgarh",
  MU: "Mumbai",
  NE: "North East",
  OR: "Odisha",
  PB: "Punjab",
  RJ: "Rajasthan",
  TN: "Tamil Nadu",
  UE: "UP East",
  UW: "UP West & Uttarakhand",
  WB: "West Bengal"
};

const SERIES_DATA = [
  require("./series9a"),
  require("./series9b"),
  require("./series8"),
  require("./series7"),
  require("./series6")
].join("\n");

let table = null;

function loadTable() {
  if (table !== null) return table;

  table = {};

  for (const m of SERIES_DATA.matchAll(/(\d{4})([A-Z]{2})([A-Z]{2})/g)) {
    table[m[1]] = {
      operator: OPERATORS[m[2]],
      circle: CIRCLES[m[3]]
    };
  }

  return table;
}

// indianLocal = 10 digit number (without +91)
function lookupSeries(indianLocal) {
  if (!indianLocal || indianLocal.length !== 10) return null;
  return loadTable()[indianLocal.slice(0, 4)] || null;
}

module.exports = { lookupSeries };
