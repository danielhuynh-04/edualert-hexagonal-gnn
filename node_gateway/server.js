/**
 * ============================================================================
 * EduAlert — Node.js v24 Enterprise BFF Gateway (Driving / Primary Adapter)
 * Architecture: Hexagonal (Ports & Adapters) + Circuit Breaker + Rate Limiter
 *               + Distributed Tracing + BFF Aggregation Layer
 * Author: Huynh Le Thanh Hai — HCMC Open University
 * ============================================================================
 */

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT || "3000", 10);
const PYTHON_CORE_HOST = process.env.PYTHON_CORE_HOST || "127.0.0.1";
const PYTHON_CORE_PORT = parseInt(process.env.PYTHON_CORE_PORT || "8000", 10);
const FRONTEND_DIR = path.resolve(__dirname, "../frontend");

// In-memory Token Bucket Rate Limiter & Circuit Breaker State (High-Availability Resilience)
const rateMap = new Map();
const circuitBreaker = {
  state: "CLOSED", // CLOSED | OPEN | HALF_OPEN
  failures: 0,
  threshold: 5,
  cooldownMs: 8000,
  nextAttempt: 0,
  totalRequests: 0,
  successfulRequests: 0,
  avgLatencyMs: 10.5,
  uptimeStart: Date.now(),
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".jsx": "text/babel; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".csv": "text/csv; charset=utf-8",
};

function checkRateLimit(ip) {
  const now = Date.now();
  const win = rateMap.get(ip) || { count: 0, resetAt: now + 60000 };
  if (now > win.resetAt) {
    win.count = 0;
    win.resetAt = now + 60000;
  }
  win.count += 1;
  rateMap.set(ip, win);
  return { allowed: win.count <= 300, remaining: Math.max(0, 300 - win.count) };
}

function setSecurityHeaders(res, correlationId, remainingRate = 300) {
  res.setHeader("X-Correlation-Id", correlationId);
  res.setHeader("X-Architecture-Pattern", "Hexagonal-Ports-And-Adapters");
  res.setHeader("X-BFF-Gateway", "Node.js-v24-Enterprise-BFF");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-RateLimit-Limit", "300");
  res.setHeader("X-RateLimit-Remaining", String(remainingRate));
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Correlation-Id, X-Requested-With");
}

function forwardToPythonCore(reqPath, method, headers, postData = null) {
  return new Promise((resolve, reject) => {
    const startNs = process.hrtime.bigint();
    const options = {
      hostname: PYTHON_CORE_HOST,
      port: PYTHON_CORE_PORT,
      path: reqPath,
      method: method,
      headers: {
        ...headers,
        "x-forwarded-by": "nodejs-bff-gateway",
      },
    };

    const req = http.request(options, (res) => {
      let chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1e6;
        circuitBreaker.avgLatencyMs = Number((0.85 * circuitBreaker.avgLatencyMs + 0.15 * elapsedMs).toFixed(2));
        circuitBreaker.successfulRequests += 1;
        circuitBreaker.failures = 0;
        circuitBreaker.state = "CLOSED";
        const bodyBuffer = Buffer.concat(chunks);
        resolve({ statusCode: res.statusCode, headers: res.headers, body: bodyBuffer });
      });
    });

    req.on("error", (err) => {
      circuitBreaker.failures += 1;
      if (circuitBreaker.failures >= circuitBreaker.threshold) {
        circuitBreaker.state = "OPEN";
        circuitBreaker.nextAttempt = Date.now() + circuitBreaker.cooldownMs;
      }
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const correlationId = req.headers["x-correlation-id"] || `req-${crypto.randomUUID().slice(0, 12)}`;
  const clientIp = req.socket.remoteAddress || "127.0.0.1";
  const rateStatus = checkRateLimit(clientIp);
  setSecurityHeaders(res, correlationId, rateStatus.remaining);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!rateStatus.allowed) {
    res.writeHead(429, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Rate limit exceeded (300 req/min)", correlationId }));
    return;
  }

  circuitBreaker.totalRequests += 1;

  // 1. Gateway Health & Circuit Breaker Telemetry Endpoint
  if (req.url === "/api/gateway/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        gateway: "Node.js v24 Enterprise BFF Gateway",
        architecture: "Hexagonal (Ports & Adapters) + Clean Domain Core",
        frontend_runtime: "React 18 SPA + SVG Visualizations",
        python_core_upstream: `http://${PYTHON_CORE_HOST}:${PYTHON_CORE_PORT}`,
        circuit_breaker: {
          ...circuitBreaker,
          uptimeSec: Math.floor((Date.now() - circuitBreaker.uptimeStart) / 1000),
        },
        correlation_id: correlationId,
        design_system: "Academic Authority & Editorial Archival Design System (Charter Serif + Tabular Figures)",
        compliance_standards: [
          "Circular 08/2021/TT-BGDĐT (Article 11 — Mandatory Override)",
          "Decree 13/2023/NĐ-CP (SHA-256 Student Anonymization)",
          "OWASP API Security (Token Bucket Rate Limiting, Immutable Audit Log)",
        ],
      })
    );
    return;
  }

  // 2. Gateway Circuit Breaker Reset (Test/Admin utility)
  if (req.url === "/api/gateway/circuit-breaker/reset" && req.method === "POST") {
    circuitBreaker.state = "CLOSED";
    circuitBreaker.failures = 0;
    circuitBreaker.nextAttempt = 0;
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ status: "reset", circuit_breaker: circuitBreaker }));
    return;
  }

  // 3. BFF Specialized Aggregation: Dashboard Overview
  if (req.url === "/api/bff/dashboard-overview") {
    try {
      const [statsRes, modelsRes] = await Promise.all([
        forwardToPythonCore("/api/stats/overview", "GET", { "x-correlation-id": correlationId }),
        forwardToPythonCore("/api/models", "GET", { "x-correlation-id": correlationId }),
      ]);
      const stats = JSON.parse(statsRes.body.toString("utf-8"));
      const models = JSON.parse(modelsRes.body.toString("utf-8"));
      const activeModel = models.models.find((m) => m.is_active) || models.models[0];

      const bffPayload = {
        stats,
        active_model: activeModel,
        gateway_telemetry: {
          circuit_breaker_state: circuitBreaker.state,
          avg_latency_ms: circuitBreaker.avgLatencyMs,
          correlation_id: correlationId,
        },
        triage_urgency_ratio: Number((stats.counts.HIGH_RISK / Math.max(1, stats.total_students) * 100).toFixed(1)),
      };

      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(bffPayload));
      return;
    } catch (err) {
      res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "BFF Aggregation failed", detail: err.message, correlationId }));
      return;
    }
  }

  // 4. Pass-through Proxy for all other /api/* endpoints
  if (req.url.startsWith("/api/")) {
    if (circuitBreaker.state === "OPEN" && Date.now() < circuitBreaker.nextAttempt) {
      res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          error: "Circuit Breaker OPEN: Python Hexagonal Core temporarily isolated",
          correlationId,
          retryAfterSec: Math.ceil((circuitBreaker.nextAttempt - Date.now()) / 1000),
        })
      );
      return;
    }

    let bodyChunks = [];
    req.on("data", (c) => bodyChunks.push(c));
    req.on("end", async () => {
      const postData = bodyChunks.length > 0 ? Buffer.concat(bodyChunks) : null;
      try {
        const resp = await forwardToPythonCore(req.url, req.method, {
          ...req.headers,
          "x-correlation-id": correlationId,
        }, postData);

        res.writeHead(resp.statusCode || 200, resp.headers);
        res.end(resp.body);
      } catch (err) {
        res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
        res.end(
          JSON.stringify({
            error: "Node.js BFF Gateway could not connect to Python Hexagonal Core",
            detail: err.message,
            correlationId,
          })
        );
      }
    });
    return;
  }

  // 5. Static File Serving with Proper MIME types
  let cleanUrl = req.url.split("?")[0];
  if (cleanUrl === "/" || cleanUrl === "/index.html") {
    cleanUrl = "/index.html";
  }

  const filePath = path.join(FRONTEND_DIR, cleanUrl);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routing
      const indexFallback = path.join(FRONTEND_DIR, "index.html");
      fs.readFile(indexFallback, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("404 Not Found");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(content);
      });
      return;
    }

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Error loading static asset");
        return;
      }
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    });
  });
});

if (require.main === module) {
  server.listen(GATEWAY_PORT, "127.0.0.1", () => {
    console.log(
      `[EduAlert Node.js v24 BFF Gateway] Listening on http://127.0.0.1:${GATEWAY_PORT} -> Python Core :${PYTHON_CORE_PORT}`
    );
  });
}

module.exports = { server };
