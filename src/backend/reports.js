
const { readIncidents, saveIncidents } = require("./store");

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

exports.submitHandler = async (event) => {
  try {
    const payload = JSON.parse(event.body || "{}");

    if (
      !payload.title ||
      !payload.city ||
      !payload.description ||
      !Array.isArray(payload.coordinates) ||
      payload.coordinates.length !== 2
    ) {
      return response(400, {
        error: "Missing required report fields",
      });
    }

    const incidents = readIncidents();

    const incident = {
      ...payload,
      id: `fl-api-${Date.now().toString(36)}`,
      timestamp: Date.now(),
      reportedAt: "Just now",
      status: "active",
      corroborationCount: 0,
      corroborationIds: [],
      source: "AWS SAM local demo",
    };

    incidents.unshift(incident);
    saveIncidents(incidents);

    return response(201, incident);
  } catch (error) {
    console.error("Failed to save report:", error);

    return response(500, {
      error: "Could not save report",
    });
  }
};
