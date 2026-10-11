
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({
  region: "ap-south-1",
  endpoint:
    process.env.DYNAMODB_ENDPOINT ||
    "http://host.docker.internal:8000",
  credentials: {
    accessKeyId: "local",
    secretAccessKey: "local",
  },
});

const db = DynamoDBDocumentClient.from(client);
const TABLE = process.env.TABLE_NAME || "FloodLensIncidents";

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

exports.handler = async (event) => {
  try {
    const method =
      event.requestContext?.http?.method || event.httpMethod;

    const route = event.rawPath || event.path || "";

    if (method === "OPTIONS") {
      return response(200, { message: "CORS preflight successful" });
    }

    // GET all incidents
    if (method === "GET" && route === "/api/v1/incidents") {
      const result = await db.send(
        new ScanCommand({ TableName: TABLE })
      );

      const incidents = (result.Items || []).sort(
        (a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0)
      );

      return response(200, incidents);
    }

    // POST a new flood report
    if (method === "POST" && route === "/api/v1/reports") {
      let payload;

      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return response(400, { error: "Invalid JSON request body" });
      }

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

      const now = Date.now();

      const incident = {
        ...payload,
        id: `fl-api-${now.toString(36)}`,
        timestamp: now,
        reportedAt: "Just now",
        status: "active",
        corroborationCount: 0,
        corroborationIds: [],
        source: "AWS SAM local demo",
        isSampleData: false,
      };

      await db.send(
        new PutCommand({
          TableName: TABLE,
          Item: incident,
          ConditionExpression: "attribute_not_exists(id)",
        })
      );

      return response(201, incident);
    }

    // POST a corroboration for an existing incident.
    // Example: POST /api/v1/incidents/fl-api-abc123/corroborate
    const corroborateMatch = route.match(
      /^\/api\/v1\/incidents\/([^/]+)\/corroborate$/
    );

    if (method === "POST" && corroborateMatch) {
      const incidentId = decodeURIComponent(corroborateMatch[1]);

      let payload = {};
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return response(400, { error: "Invalid JSON request body" });
      }

      const voterId = String(payload.voterId || "").trim();

      if (!voterId) {
        return response(400, {
          error: "voterId is required to record a corroboration",
        });
      }

      // A conditional update prevents the same voter ID being counted twice.
      try {
        const result = await db.send(
          new UpdateCommand({
            TableName: TABLE,
            Key: { id: incidentId },
            UpdateExpression:
              "SET corroborationCount = if_not_exists(corroborationCount, :zero) + :one, corroborationIds = list_append(if_not_exists(corroborationIds, :empty), :voters)",
            ConditionExpression:
              "attribute_exists(id) AND (attribute_not_exists(corroborationIds) OR NOT contains(corroborationIds, :voterId))",
            ExpressionAttributeValues: {
              ":zero": 0,
              ":one": 1,
              ":empty": [],
              ":voters": [voterId],
              ":voterId": voterId,
            },
            ReturnValues: "ALL_NEW",
          })
        );

        return response(200, result.Attributes);
      } catch (error) {
        if (error.name === "ConditionalCheckFailedException") {
          return response(409, {
            error: "Incident not found or this voter already corroborated it",
          });
        }

        throw error;
      }
    }

    return response(404, { error: "Route not found" });
  } catch (error) {
    console.error("FloodLens DynamoDB error:", error);

    return response(500, {
      error: "Database request failed",
      details: error.message,
    });
  }
};
