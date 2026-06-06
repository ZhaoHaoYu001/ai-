import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createAppServer } from "../server.js";

async function withServer(run) {
  const server = createAppServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("serves the FluentLoop app entry point", async () => {
  await withServer(async baseUrl => {
    const response = await fetch(baseUrl);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /FluentLoop/);
  });
});

test("exposes a health endpoint for startup diagnosis", async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok", app: "FluentLoop", ai: false });
  });
});

test("serves contextual AI coach responses through the protected server endpoint", async () => {
  const coachService = {
    available: true,
    async respond(payload) {
      return { coachReply: `Tell me more about ${payload.answer}`, translation: "请详细说明。", feedback: {} };
    }
  };
  const server = createAppServer(process.cwd(), { coachService });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/coach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenario: { title: "Job Interview" },
        messages: [],
        answer: "my launch"
      })
    });
    assert.equal(response.status, 200);
    assert.match((await response.json()).coachReply, /my launch/);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("validates coach request content and size", async () => {
  await withServer(async baseUrl => {
    const wrongType = await fetch(`${baseUrl}/api/coach`, {
      method: "POST",
      body: "{}"
    });
    assert.equal(wrongType.status, 415);

    const invalid = await fetch(`${baseUrl}/api/coach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: { title: "Interview" }, messages: [], answer: "x".repeat(2001) })
    });
    assert.equal(invalid.status, 400);

    const oversized = await fetch(`${baseUrl}/api/coach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: "x".repeat(70_000) })
    });
    assert.equal(oversized.status, 413);
  });
});

test("does not expose upstream coach errors", async () => {
  const coachService = {
    available: true,
    async respond() {
      throw new Error("secret upstream detail");
    }
  };
  const server = createAppServer(process.cwd(), { coachService });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/coach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: { title: "Interview" }, messages: [], answer: "Hello" })
    });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: "Coach service is temporarily unavailable" });
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("rejects paths outside the app root", async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/..%2fpackage.json`);
    assert.equal(response.status, 403);
  });
});

test("returns 404 for missing assets", async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/missing.js`);
    assert.equal(response.status, 404);
  });
});
