/**
 * EduAlert — Automated Integration Test for Node.js v24 BFF Gateway
 */

const http = require("http");
const assert = require("assert");
const { server } = require("../node_gateway/server.js");

const TEST_PORT = 3001;

function makeRequest(path, method = "GET", headers = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: TEST_PORT,
        path: path,
        method: method,
        headers: headers,
      },
      (res) => {
        let chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf-8"),
          });
        });
      }
    );
    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log("Starting Node.js Gateway Integration Tests on port " + TEST_PORT + "...");
  server.listen(TEST_PORT, "127.0.0.1");

  try {
    // 1. Health & Architecture endpoint
    console.log("1. Testing /api/gateway/health...");
    const health = await makeRequest("/api/gateway/health");
    assert.strictEqual(health.statusCode, 200, "Health should return 200");
    const healthJson = JSON.parse(health.body);
    assert.strictEqual(healthJson.gateway, "Node.js v24 Enterprise BFF Gateway");
    assert.strictEqual(health.headers["x-architecture-pattern"], "Hexagonal-Ports-And-Adapters");
    assert.ok(health.headers["x-correlation-id"], "Correlation ID must exist");
    console.log("   ✓ Health check passed with Correlation ID:", health.headers["x-correlation-id"]);

    // 2. Static file: index.html
    console.log("2. Testing static file / (index.html)...");
    const indexRes = await makeRequest("/");
    assert.strictEqual(indexRes.statusCode, 200, "index.html should return 200");
    assert.ok(indexRes.headers["content-type"].includes("text/html"), "Content-Type must be text/html");
    assert.ok(indexRes.body.includes('<div id="root">'), "Body must contain root mount point");
    assert.ok(indexRes.body.includes('src="react_app.jsx"'), "Body must load react_app.jsx");
    console.log("   ✓ index.html served properly with React 18 mount point");

    // 3. Static file: react_app.jsx
    console.log("3. Testing static file /react_app.jsx...");
    const jsxRes = await makeRequest("/react_app.jsx");
    assert.strictEqual(jsxRes.statusCode, 200, "react_app.jsx should return 200");
    assert.ok(jsxRes.headers["content-type"].includes("text/babel"), "Content-Type must be text/babel");
    assert.ok(jsxRes.body.includes("EduAlert — React 18 Hexagonal SPA"), "JSX must contain EduAlert SPA code");
    console.log("   ✓ react_app.jsx served with text/babel MIME type");

    // 4. Static offline vendor bundles
    console.log("4. Testing vendor scripts (react.min.js, react-dom.min.js, babel.min.js)...");
    const reactRes = await makeRequest("/react.min.js");
    assert.strictEqual(reactRes.statusCode, 200);
    assert.ok(reactRes.headers["content-type"].includes("application/javascript"));

    const domRes = await makeRequest("/react-dom.min.js");
    assert.strictEqual(domRes.statusCode, 200);

    const babelRes = await makeRequest("/babel.min.js");
    assert.strictEqual(babelRes.statusCode, 200);
    console.log("   ✓ Offline vendor scripts are 100% available without external network");

    // 5. Circuit Breaker Reset
    console.log("5. Testing /api/gateway/circuit-breaker/reset...");
    const resetRes = await makeRequest("/api/gateway/circuit-breaker/reset", "POST");
    assert.strictEqual(resetRes.statusCode, 200);
    const resetJson = JSON.parse(resetRes.body);
    assert.strictEqual(resetJson.status, "reset");
    assert.strictEqual(resetJson.circuit_breaker.state, "CLOSED");
    console.log("   ✓ Circuit breaker reset endpoint operates correctly");

    console.log("\n=======================================================");
    console.log("ALL NODE.JS GATEWAY INTEGRATION TESTS PASSED (5/5)! 🎯");
    console.log("=======================================================");
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
