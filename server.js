"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY_BYTES = 12 * 1024;
const VALID_CHANNELS = new Set([
  "Helpline 14566",
  "Integrated portal",
  "Mobile app",
  "Chatbot",
  "IVRS"
]);
const VALID_LANGUAGES = new Set([
  "Hindi",
  "English",
  "मराठी (Marathi)",
  "தமிழ் (Tamil)",
  "తెలుగు (Telugu)",
  "বাংলা (Bengali)",
  "ಕನ್ನಡ (Kannada)",
  "ગુજરાતી (Gujarati)",
  "Other / interpreter requested"
]);
const VALID_INDICATORS = new Set([
  "danger",
  "selfharm",
  "threat",
  "isolation",
  "medical"
]);

const cases = [
  { id: "TS-24081", label: "Complainant · Adult", channel: "Helpline 14566", time: "2 min ago", score: 91, risk: "Critical", language: "Hindi", initials: "C1", summary: "Person reports immediate fear for their safety and difficulty returning home. A live safety check is the priority.", actions: [{ title: "Confirm immediate safety & safe contact method", note: "Stay connected and follow local emergency protocol.", priority: "NOW" }, { title: "Offer emergency police support", note: "Ask permission; follow approved escalation process.", priority: "URGENT" }, { title: "Offer trauma-informed counselling", note: "Arrange a qualified counsellor when the person is safe.", priority: "TODAY" }] },
  { id: "TS-24076", label: "Complainant · Adult", channel: "Integrated portal", time: "18 min ago", score: 74, risk: "High", language: "Marathi", initials: "C2", summary: "Narrative indicates fear and reported intimidation. Verify current safety and the preferred way to follow up.", actions: [{ title: "Check whether it is safe to call back", note: "Agree on a safe time and method for contact.", priority: "TODAY" }, { title: "Offer legal aid referral", note: "Explain available options without pressure.", priority: "TODAY" }, { title: "Offer counselling support", note: "Ask whether a language-matched counsellor is preferred.", priority: "" }] },
  { id: "TS-24068", label: "Complainant · Adult", channel: "Mobile app", time: "42 min ago", score: 48, risk: "Moderate", language: "Tamil", initials: "C3", summary: "Person describes ongoing worry related to a case. No immediate safety concern was recorded; ask what support feels useful.", actions: [{ title: "Ask what support would help most", note: "Respect their priorities and pace.", priority: "" }, { title: "Offer counselling information", note: "Referral only with consent.", priority: "" }] },
  { id: "TS-24054", label: "Complainant · Adult", channel: "Chatbot", time: "1 hr ago", score: 26, risk: "Low", language: "Hindi", initials: "C4", summary: "No immediate distress indicators selected. Confirm understanding and offer a route back to support.", actions: [{ title: "Share support contact options", note: "Explain how to reconnect with NHAA support.", priority: "" }] }
];

function json(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(data));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = "";
    let tooLarge = false;
    request.setEncoding("utf8");
    request.on("data", chunk => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
      } else if (!tooLarge) {
        body += chunk;
      }
    });
    request.on("end", () => {
      if (tooLarge) {
        reject(Object.assign(new Error("Request body is too large."), { status: 413 }));
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON."), { status: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function validateAssessment(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "A JSON assessment object is required.";
  }
  if (value.consent !== true) return "Informed consent is required.";
  if (typeof value.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{2,23}$/.test(value.id.trim())) {
    return "Case reference must be 3–24 letters, numbers, dashes, or underscores.";
  }
  if (!VALID_CHANNELS.has(value.channel)) return "Choose a supported contact channel.";
  if (!VALID_LANGUAGES.has(value.language)) return "Choose a supported language.";
  if (!Number.isInteger(value.distress) || value.distress < 0 || value.distress > 10) {
    return "Self-reported distress must be a whole number from 0 to 10.";
  }
  if (!Array.isArray(value.indicators) || value.indicators.length > VALID_INDICATORS.size ||
      value.indicators.some(item => !VALID_INDICATORS.has(item)) ||
      new Set(value.indicators).size !== value.indicators.length) {
    return "One or more support indicators are invalid.";
  }
  if (typeof value.textualUrgent !== "boolean") return "Textual urgency flag must be a boolean.";
  return null;
}

function createAssessment(value) {
  const indicators = value.indicators;
  const urgent = indicators.some(item => ["danger", "selfharm", "medical"].includes(item)) || value.textualUrgent;
  const score = Math.min(100, Math.round(value.distress * 7 + indicators.length * 12 + (urgent ? 30 : 0)));
  const risk = urgent || score >= 75 ? "Critical" : score >= 55 ? "High" : score >= 30 ? "Moderate" : "Low";
  const safeId = value.id.trim();
  const assessment = {
    id: safeId,
    label: "Complainant · Adult",
    channel: value.channel,
    time: "Just now",
    score,
    risk,
    language: value.language,
    initials: "N",
    summary: "New demo assessment. Confirm the person's immediate needs and preferred next step directly.",
    actions: urgent
      ? [
          { title: "Confirm immediate safety & safe contact method", note: "Stay connected and follow approved emergency protocol.", priority: "NOW" },
          { title: "Offer appropriate live support", note: "Ask permission and coordinate with the qualified team.", priority: "URGENT" }
        ]
      : [
          { title: "Confirm preferred support", note: "Ask the person what would be most helpful.", priority: "" },
          { title: "Offer counselling or legal aid referral", note: "Proceed only with consent.", priority: "" }
        ]
  };
  const duplicateIndex = cases.findIndex(item => item.id.toLowerCase() === safeId.toLowerCase());
  if (duplicateIndex >= 0) cases.splice(duplicateIndex, 1);
  cases.unshift(assessment);
  return { ...assessment, urgent };
}

function serveStatic(request, response) {
  const pathname = new URL(request.url, `http://${HOST}:${PORT}`).pathname;
  if (pathname !== "/" && pathname !== "/index.html") {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  fs.readFile(path.join(__dirname, "index.html"), (error, content) => {
    if (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Unable to load the app.");
      return;
    }
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    });
    response.end(content);
  });
}

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://${HOST}:${PORT}`).pathname;
  if (request.method === "GET" && pathname === "/api/health") {
    json(response, 200, { status: "ok", mode: "demo", persistence: "in-memory" });
    return;
  }
  if (request.method === "GET" && pathname === "/api/cases") {
    json(response, 200, { cases });
    return;
  }
  if (request.method === "POST" && pathname === "/api/assessments") {
    try {
      const value = await readJson(request);
      const error = validateAssessment(value);
      if (error) {
        json(response, 400, { error });
        return;
      }
      json(response, 201, { assessment: createAssessment(value) });
    } catch (error) {
      if (!response.destroyed && !response.headersSent) {
        json(response, error.status || 400, { error: error.message || "Unable to read assessment." });
      }
    }
    return;
  }
  if (request.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    serveStatic(request, response);
    return;
  }
  if (pathname.startsWith("/api/")) {
    json(response, 404, { error: "API route not found." });
    return;
  }
  serveStatic(request, response);
});

server.listen(PORT, HOST, () => {
  console.log(`TraumaSense demo running at http://${HOST}:${PORT}`);
  console.log("Demo only: in-memory sample data; do not enter real personal or case information.");
});
