"use strict";

/**
 * Log minimo com nivel e horario. Substitui a sequencia de
 * console.log("Passo 1..10") que existia antes: aqueles avisos nao diziam nada
 * util depois que o servidor subia pela primeira vez e escondiam as mensagens
 * que importam.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[process.env.LOG_LEVEL] || LEVELS.info;

function timestamp() {
  return new Date().toISOString().slice(11, 19);
}

function emit(level, stream, ...args) {
  if (LEVELS[level] < threshold) return;
  stream(`${timestamp()} ${level.toUpperCase().padEnd(5)}`, ...args);
}

module.exports = {
  debug: (...args) => emit("debug", console.log, ...args),
  info: (...args) => emit("info", console.log, ...args),
  warn: (...args) => emit("warn", console.warn, ...args),
  error: (...args) => emit("error", console.error, ...args),
};
