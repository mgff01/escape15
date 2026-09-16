"use strict";

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

const { parseLine, normalizeColorName } = require("../src/protocol");

describe("parseLine", () => {
  test("lê uma mensagem de cor em JSON", () => {
    const message = parseLine(
      '{"t":"color","name":"Verde","hex":"#12a34b","rgb":[18,163,75],"lux":312.4,"sat":false}',
    );
    assert.equal(message.type, "color");
    assert.equal(message.name, "Verde");
    assert.equal(message.hex, "#12A34B");
    assert.deepEqual(message.rgb, [18, 163, 75]);
    assert.equal(message.saturated, false);
    assert.equal(message.lux, 312.4);
  });

  test("calcula o hex quando só vem o RGB", () => {
    const message = parseLine('{"t":"color","name":"Azul","rgb":[0,100,224]}');
    assert.equal(message.hex, "#0064E0");
  });

  test("marca leitura saturada", () => {
    const message = parseLine('{"t":"color","name":"Branco","sat":true}');
    assert.equal(message.saturated, true);
  });

  test("aceita o formato antigo, só com o nome da cor", () => {
    const message = parseLine("Vermelho\r\n");
    assert.deepEqual(message, {
      type: "color",
      name: "Vermelho",
      hex: null,
      rgb: null,
      saturated: false,
      lux: null,
    });
  });

  test("normaliza acentos e caixa", () => {
    assert.equal(parseLine("VERMELHO").name, "Vermelho");
    assert.equal(parseLine("magenta").name, "Magenta");
  });

  test("descarta cores que o firmware nunca envia", () => {
    assert.equal(parseLine("Roxo"), null);
    assert.equal(parseLine('{"t":"color","name":"Roxo"}'), null);
  });

  test("descarta JSON truncado sem lançar", () => {
    assert.equal(parseLine('{"t":"color","name":"Ve'), null);
  });

  test("descarta linhas vazias e entradas inválidas", () => {
    assert.equal(parseLine(""), null);
    assert.equal(parseLine("   "), null);
    assert.equal(parseLine(null), null);
    assert.equal(parseLine(undefined), null);
    assert.equal(parseLine(42), null);
  });

  test("descarta linhas absurdamente longas", () => {
    assert.equal(parseLine("A".repeat(5000)), null);
  });

  test("rejeita RGB fora da faixa", () => {
    const message = parseLine('{"t":"color","name":"Verde","rgb":[300,0,0]}');
    assert.equal(message.rgb, null);
    assert.equal(message.hex, null);
  });

  test("reconhece log, status e hello", () => {
    assert.deepEqual(parseLine('{"t":"log","level":"warn","msg":"oi"}'), {
      type: "log",
      level: "warn",
      message: "oi",
    });
    assert.deepEqual(parseLine('{"t":"status","sensor":true,"display":false,"calibrated":true}'), {
      type: "status",
      sensor: true,
      display: false,
      calibrated: true,
    });
    assert.deepEqual(parseLine('{"t":"hello","fw":"2.0.0","proto":1}'), {
      type: "hello",
      firmware: "2.0.0",
      protocol: 1,
    });
  });

  test("ignora tipos desconhecidos", () => {
    assert.equal(parseLine('{"t":"telemetria","x":1}'), null);
  });
});

describe("normalizeColorName", () => {
  test("remove acentos", () => {
    assert.equal(normalizeColorName("ÁZUL"), "Azul");
  });

  test("devolve vazio para entrada inválida", () => {
    assert.equal(normalizeColorName(undefined), "");
    assert.equal(normalizeColorName("   "), "");
  });
});
