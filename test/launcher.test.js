import test from "node:test";
import assert from "node:assert/strict";
import { isFluentLoopReady } from "../scripts/launch-fluentloop.mjs";

test("recognizes a healthy FluentLoop service", async () => {
  const ready = await isFluentLoopReady("http://example.test", async url => ({
    ok: url.endsWith("/health"),
    async json() { return { status: "ok", app: "FluentLoop" }; }
  }));
  assert.equal(ready, true);
});

test("rejects another service occupying the same port", async () => {
  const ready = await isFluentLoopReady("http://example.test", async () => ({
    ok: true,
    async json() { return { status: "ok", app: "Another app" }; }
  }));
  assert.equal(ready, false);
});

test("handles an unavailable local service", async () => {
  const ready = await isFluentLoopReady("http://example.test", async () => {
    throw new Error("connection refused");
  });
  assert.equal(ready, false);
});
