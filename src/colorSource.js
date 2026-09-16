"use strict";

const { EventEmitter } = require("node:events");

const logger = require("./logger");
const { parseLine, KNOWN_COLOR_NAMES } = require("./protocol");

/**
 * Fonte de cores para o jogo.
 *
 * Eventos emitidos:
 *   "color"  -> { name, hex, rgb, saturated, lux }
 *   "status" -> { state: "searching"|"connected"|"disconnected"|"mock", detail }
 *   "device" -> { type: "log"|"status"|"hello", ... } (diagnostico do firmware)
 *
 * Duas implementacoes: a serial de verdade e um gerador para demonstracao.
 * O modo demonstracao existe porque o jogo precisa ser testavel (e apresentavel)
 * sem a placa por perto.
 */
class ColorSource extends EventEmitter {
  constructor() {
    super();
    this.status = { state: "searching", detail: "iniciando" };
  }

  setStatus(state, detail = "") {
    this.status = { state, detail };
    this.emit("status", this.status);
  }

  /* eslint-disable class-methods-use-this */
  async start() {}
  async stop() {}
  /* eslint-enable class-methods-use-this */
}

class SerialColorSource extends ColorSource {
  constructor(config) {
    super();
    this.config = config;
    this.port = null;
    this.reconnectTimer = null;
    this.reconnectDelay = config.reconnectMinMs;
    this.stopped = false;
  }

  /** Descobre a porta do ESP32 quando nenhuma foi informada. */
  async resolvePath({ SerialPort }) {
    if (this.config.serialPath) return this.config.serialPath;

    const ports = await SerialPort.list();
    const candidate = ports.find((port) =>
      this.config.knownUsbVendorIds.includes(String(port.vendorId || "").toLowerCase()),
    );
    if (candidate) {
      logger.info(
        `Porta detectada automaticamente: ${candidate.path} (${candidate.manufacturer || "fabricante desconhecido"})`,
      );
      return candidate.path;
    }

    if (ports.length > 0) {
      logger.debug(`Portas disponiveis: ${ports.map((p) => p.path).join(", ")}`);
    }
    return null;
  }

  async start() {
    this.stopped = false;
    await this.connect();
  }

  async connect() {
    if (this.stopped) return;

    let SerialPort;
    let ReadlineParser;
    try {
      ({ SerialPort } = require("serialport"));
      ({ ReadlineParser } = require("@serialport/parser-readline"));
    } catch (error) {
      // O serialport tem binario nativo; em maquina sem toolchain ele falha ao
      // carregar. Isso nao pode derrubar o servidor: o jogo ainda abre, so nao
      // recebe cores.
      this.setStatus("disconnected", "modulo serialport indisponivel");
      logger.error(`Nao foi possivel carregar o serialport: ${error.message}`);
      logger.error("Rode com --mock para jogar sem a placa.");
      return;
    }

    let path;
    try {
      path = await this.resolvePath({ SerialPort });
    } catch (error) {
      logger.warn(`Falha ao listar portas seriais: ${error.message}`);
      path = null;
    }

    if (!path) {
      this.setStatus("searching", "nenhuma placa encontrada");
      this.scheduleReconnect("nenhuma porta compativel encontrada");
      return;
    }

    this.setStatus("searching", `abrindo ${path}`);
    const port = new SerialPort({ path, baudRate: this.config.baudRate, autoOpen: false });
    this.port = port;

    port.open((error) => {
      if (error) {
        this.scheduleReconnect(`nao foi possivel abrir ${path}: ${error.message}`);
        return;
      }
      this.reconnectDelay = this.config.reconnectMinMs;
      this.setStatus("connected", path);
      logger.info(`Conectado a ${path} em ${this.config.baudRate} baud`);
    });

    // O firmware novo termina as linhas em "\n" e o antigo em "\r\n"; o parser
    // corta em "\n" e o parseLine faz trim, entao os dois funcionam.
    const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));
    parser.on("data", (line) => this.handleLine(line));

    port.on("error", (error) => {
      logger.warn(`Erro na serial: ${error.message}`);
    });
    port.on("close", () => {
      if (this.stopped) return;
      this.setStatus("disconnected", "placa desconectada");
      this.scheduleReconnect("conexao encerrada");
    });
  }

  handleLine(line) {
    const message = parseLine(line);
    if (!message) {
      logger.debug(`Linha ignorada: ${String(line).trim()}`);
      return;
    }

    if (message.type === "color") {
      const { type, ...color } = message;
      logger.debug(`Cor recebida: ${color.name}`);
      this.emit("color", color);
      return;
    }

    if (message.type === "log") {
      logger.info(`[placa] ${message.message}`);
    }
    this.emit("device", message);
  }

  scheduleReconnect(reason) {
    if (this.stopped || this.reconnectTimer) return;
    logger.warn(`${reason}. Nova tentativa em ${Math.round(this.reconnectDelay / 1000)}s.`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      // Backoff exponencial ate o teto, para nao inundar o log enquanto a placa
      // estiver desligada.
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.config.reconnectMaxMs);
      this.connect().catch((error) => logger.error(`Reconexao falhou: ${error.message}`));
    }, this.reconnectDelay);
    this.reconnectTimer.unref?.();
  }

  async stop() {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.port?.isOpen) {
      await new Promise((resolve) => this.port.close(resolve));
    }
    this.port = null;
  }
}

class MockColorSource extends ColorSource {
  constructor(config) {
    super();
    this.config = config;
    this.timer = null;
    this.names = [...KNOWN_COLOR_NAMES];
    this.index = 0;
  }

  async start() {
    this.setStatus("mock", "gerando cores de demonstracao");
    logger.info("Modo demonstracao: cores aleatorias a cada " + this.config.mockIntervalMs + "ms");
    this.timer = setInterval(() => this.tick(), this.config.mockIntervalMs);
    this.timer.unref?.();
    this.tick();
  }

  tick() {
    const name = this.names[this.index % this.names.length];
    this.index += 1;
    this.emit("color", { name, hex: null, rgb: null, saturated: false, lux: null });
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

function createColorSource(config) {
  return config.mock ? new MockColorSource(config) : new SerialColorSource(config);
}

module.exports = { createColorSource, ColorSource, SerialColorSource, MockColorSource };
