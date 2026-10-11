
const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = "/tmp/.floodlens-data";
const DATA_FILE = path.join(DATA_DIR, "incidents.json");

function readIncidents() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]), "utf8");
  }

  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveIncidents(incidents) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(incidents, null, 2), "utf8");
}

module.exports = { readIncidents, saveIncidents };
