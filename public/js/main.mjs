/**
 * Ponto de entrada da página: liga o motor do jogo (game.mjs), a interface
 * (ui.mjs) e o servidor (connection.mjs).
 */
import {
  COLORS,
  IGNORED_SENSOR_NAMES,
  LIVES,
  PUZZLES,
  SENSOR_NAME_TO_COLOR_ID,
  UNIVERSAL_HINT,
} from "./config.mjs";
import { connectToServer } from "./connection.mjs";
import { Game, Outcome, Status } from "./game.mjs";
import { UI } from "./ui.mjs";

/** Pausa entre resolver um enigma e o próximo aparecer. */
const ADVANCE_DELAY_MS = 1600;

const game = new Game({ puzzles: PUZZLES, colors: COLORS, lives: LIVES });

const ui = new UI({
  colors: COLORS,
  onApplyColor: handleApplyColor,
  onRestart: handleRestart,
  onUnlockColor: (colorId) => unlock(colorId, { manual: true }),
});

ui.setHint(UNIVERSAL_HINT);
ui.render(game.state);

let advanceTimer = null;

function handleApplyColor(colorId) {
  // Durante a animação de acerto o tabuleiro está congelado.
  if (advanceTimer) return;

  const result = game.applyColor(colorId);

  switch (result.outcome) {
    case Outcome.Locked:
      ui.toast("Essa cor ainda não foi lida no sensor.", "info");
      return;

    case Outcome.AlreadyApplied:
      ui.toast("Essa cor já está aplicada.", "info");
      return;

    case Outcome.AlreadyRejected:
      ui.toast("Você já tentou essa cor neste logo.", "info");
      return;

    case Outcome.Wrong:
      ui.shake();
      ui.toast(`Não é essa. Restam ${result.livesLeft} vidas.`, "error");
      ui.renderMeters(game.state);
      return;

    case Outcome.GameOver:
      ui.shake();
      ui.renderMeters(game.state);
      ui.showGameOver();
      return;

    case Outcome.Partial:
      ui.toast("Boa! Falta mais uma cor.", "success");
      ui.renderChips(game.state);
      ui.clearSelection(game.state);
      return;

    case Outcome.Solved:
      ui.markSolved();
      ui.renderChips(game.state);
      ui.renderWords(game.state);
      ui.renderMeters(game.state);
      ui.toast(`Palavra revelada: "${result.word}"`, "success");
      ui.clearSelection(game.state);
      advanceTimer = setTimeout(() => {
        advanceTimer = null;
        if (game.advance() === Status.Complete) {
          ui.render(game.state);
          ui.showVictory(game.phrase);
        } else {
          ui.render(game.state);
        }
      }, ADVANCE_DELAY_MS);
      return;

    default:
      // Ignored: a partida já tinha acabado.
  }
}

function handleRestart() {
  clearTimeout(advanceTimer);
  advanceTimer = null;
  game.restart();
  ui.clearSelection(game.state);
  ui.render(game.state);
  ui.toast("Partida reiniciada.", "info");
}

function unlock(colorId, { manual = false } = {}) {
  const isNew = game.unlockColor(colorId);
  if (!isNew) return;

  ui.renderPalette(game.state);
  ui.highlightColor(colorId);
  const colorName = COLORS[colorId]?.name ?? colorId;
  ui.toast(
    manual ? `${colorName} destravada manualmente.` : `${colorName} destravada!`,
    "success",
  );
}

connectToServer({
  onStatus: (status) => ui.setConnection(status.state, status.detail),

  onColor: (color) => {
    ui.setLastReading(color.hex ? `${color.name} (${color.hex})` : color.name);

    const colorId = SENSOR_NAME_TO_COLOR_ID[color.name];
    if (colorId) {
      unlock(colorId);
    } else if (!IGNORED_SENSOR_NAMES.has(color.name)) {
      // Cor lida que não existe na paleta: útil saber ao calibrar o sensor.
      ui.setLastReading(`${color.name} (fora da paleta)`);
    }
  },

  onDeviceMessage: (message) => {
    if (message.type === "log" && message.level === "error") {
      ui.toast(`Placa: ${message.message}`, "error");
    }
  },
});
