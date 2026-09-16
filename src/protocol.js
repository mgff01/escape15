"use strict";

/**
 * Leitura do protocolo serial do Kroma.
 *
 * O firmware atual fala JSON Lines (ver docs/PROTOCOL.md no repositorio Kroma).
 * Firmwares antigos imprimiam apenas o nome da cor, entao esse formato continua
 * aceito como fallback -- a placa que estiver na feira pode estar com qualquer
 * uma das duas versoes gravadas.
 */

// Uma linha valida nunca chega perto disso. O limite existe para que lixo na
// serial (placa em boot, baud errado) nao vire alocacao grande.
const MAX_LINE_LENGTH = 2048;

// Nomes que o firmware pode enviar. Qualquer coisa fora dessa lista e tratada
// como leitura desconhecida em vez de virar um evento de cor invalido.
const KNOWN_COLOR_NAMES = new Set([
  "Vermelho",
  "Laranja",
  "Amarelo",
  "Verde",
  "Ciano",
  "Azul",
  "Magenta",
  "Branco",
  "Cinza",
  "Preto",
]);

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Remove acentos e normaliza a caixa, para "VERDE" e "Verde" baterem. */
function normalizeColorName(raw) {
  if (typeof raw !== "string") return "";
  const stripped = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  if (stripped.length === 0) return "";
  return stripped.charAt(0).toUpperCase() + stripped.slice(1).toLowerCase();
}

function isValidRgb(value) {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255)
  );
}

function rgbToHex([r, g, b]) {
  const toPair = (channel) => channel.toString(16).padStart(2, "0");
  return `#${toPair(r)}${toPair(g)}${toPair(b)}`.toUpperCase();
}

function parseColorMessage(payload) {
  const name = normalizeColorName(payload.name);
  if (!KNOWN_COLOR_NAMES.has(name)) return null;

  const rgb = isValidRgb(payload.rgb) ? payload.rgb : null;
  let hex = typeof payload.hex === "string" && HEX_PATTERN.test(payload.hex)
    ? payload.hex.toUpperCase()
    : null;
  if (!hex && rgb) hex = rgbToHex(rgb);

  return {
    type: "color",
    name,
    hex,
    rgb,
    saturated: payload.sat === true,
    lux: Number.isFinite(payload.lux) ? payload.lux : null,
  };
}

/**
 * Converte uma linha crua da serial em um evento.
 *
 * @param {string} line
 * @returns {object|null} o evento, ou null se a linha nao disser nada util.
 */
function parseLine(line) {
  if (typeof line !== "string") return null;
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_LINE_LENGTH) return null;

  if (trimmed.startsWith("{")) {
    let payload;
    try {
      payload = JSON.parse(trimmed);
    } catch {
      // Linha JSON truncada: acontece quando o servidor conecta no meio de uma
      // transmissao. Ignorar e esperar a proxima e o comportamento certo.
      return null;
    }
    if (payload === null || typeof payload !== "object") return null;

    switch (payload.t) {
      case "color":
        return parseColorMessage(payload);
      case "log":
        return {
          type: "log",
          level: typeof payload.level === "string" ? payload.level : "info",
          message: typeof payload.msg === "string" ? payload.msg : "",
        };
      case "status":
        return {
          type: "status",
          sensor: payload.sensor === true,
          display: payload.display === true,
          calibrated: payload.calibrated === true,
        };
      case "hello":
        return {
          type: "hello",
          firmware: typeof payload.fw === "string" ? payload.fw : "desconhecido",
          protocol: Number.isInteger(payload.proto) ? payload.proto : 0,
        };
      default:
        return null;
    }
  }

  // Formato antigo: a linha inteira e o nome da cor.
  const name = normalizeColorName(trimmed);
  if (!KNOWN_COLOR_NAMES.has(name)) return null;
  return { type: "color", name, hex: null, rgb: null, saturated: false, lux: null };
}

module.exports = { parseLine, normalizeColorName, KNOWN_COLOR_NAMES, MAX_LINE_LENGTH };
