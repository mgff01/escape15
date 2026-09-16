import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { loadConfig } from "../src/config.js";
import serverModule from "../src/server.js";

const { startServer } = serverModule;

describe("servidor", () => {
  let handle;
  let baseUrl;

  before(async () => {
    // Porta 0 = o sistema escolhe uma livre, então o teste não briga com um
    // servidor que já esteja rodando na 3000.
    handle = await startServer({ ...loadConfig([], {}), port: 0, mock: true });
    baseUrl = `http://127.0.0.1:${handle.server.address().port}`;
  });

  after(async () => {
    await handle?.close();
  });

  test("serve a página do jogo", async () => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Enigma das Marcas/);
  });

  test("serve os módulos do cliente", async () => {
    const response = await fetch(`${baseUrl}/js/game.mjs`);
    assert.equal(response.status, 200);
  });

  test("/api/health descreve a fonte de cores", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, "ok");
    assert.equal(body.mock, true);
    assert.equal(body.source.state, "mock");
    // O modo demonstração emite a primeira cor assim que sobe.
    assert.ok(body.lastColor);
  });
});
