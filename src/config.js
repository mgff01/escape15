"use strict";

/**
 * Configuracao do servidor, lida de variaveis de ambiente e da linha de
 * comando. Antes a porta serial era uma constante no meio do arquivo ("COM12"),
 * o que obrigava a editar o codigo a cada maquina diferente.
 */

// Fabricantes dos conversores USB-serial usados em placas ESP32/Arduino. Serve
// para adivinhar a porta certa quando nenhuma e informada.
const KNOWN_USB_VENDOR_IDS = [
  "10c4", // Silicon Labs CP210x
  "1a86", // QinHeng CH340 / CH9102
  "0403", // FTDI
  "303a", // Espressif (USB nativo do ESP32-S2/S3/C3)
  "2341", // Arduino
];

function parseIntOr(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function loadConfig(argv = process.argv.slice(2), env = process.env) {
  return {
    // Porta HTTP do jogo.
    port: parseIntOr(env.PORT, 3000),
    // Caminho da porta serial. Vazio significa "descubra sozinho".
    serialPath: env.SERIAL_PORT || "",
    baudRate: parseIntOr(env.BAUD_RATE, 115200),
    // Modo demonstracao: gera cores aleatorias, sem hardware nenhum.
    mock: argv.includes("--mock") || env.MOCK === "1",
    // Intervalo entre cores no modo demonstracao.
    mockIntervalMs: parseIntOr(env.MOCK_INTERVAL_MS, 4000),
    // Backoff de reconexao da serial.
    reconnectMinMs: parseIntOr(env.RECONNECT_MIN_MS, 1000),
    reconnectMaxMs: parseIntOr(env.RECONNECT_MAX_MS, 15000),
    knownUsbVendorIds: KNOWN_USB_VENDOR_IDS,
  };
}

module.exports = { loadConfig, KNOWN_USB_VENDOR_IDS };
