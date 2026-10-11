
const { readIncidents } = require("./store");

exports.getHandler = async () => {
  try {
    const incidents = readIncidents();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(incidents),
    };
  } catch (error) {
    console.error("Failed to read incidents:", error);

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Could not read incidents" }),
    };
  }
};
