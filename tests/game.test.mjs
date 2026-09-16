import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { Game, Outcome, Status } from "../public/js/game.mjs";

const COLORS = {
  red: { name: "Vermelho", hex: "#D92E2E" },
  green: { name: "Verde", hex: "#009739" },
  blue: { name: "Azul", hex: "#0064E0" },
};

const PUZZLES = [
  { brandName: "Um", logoFile: "a.png", requiredColors: ["green"], revealedWord: "primeira" },
  {
    brandName: "Dois",
    logoFile: "b.png",
    requiredColors: ["red", "blue"],
    revealedWord: "segunda",
  },
];

function newGame(options = {}) {
  const game = new Game({ puzzles: PUZZLES, colors: COLORS, lives: 3, ...options });
  for (const id of Object.keys(COLORS)) game.unlockColor(id);
  return game;
}

describe("Game", () => {
  test("exige pelo menos um enigma", () => {
    assert.throws(() => new Game({ puzzles: [], colors: COLORS }), /pelo menos um enigma/);
  });

  test("começa no primeiro enigma, com todas as vidas e nada destravado", () => {
    const game = new Game({ puzzles: PUZZLES, colors: COLORS, lives: 3 });
    assert.equal(game.state.status, Status.Playing);
    assert.equal(game.state.lives, 3);
    assert.equal(game.state.puzzleIndex, 0);
    assert.deepEqual(game.state.unlockedColors, []);
  });

  test("cor bloqueada não custa vida", () => {
    const game = new Game({ puzzles: PUZZLES, colors: COLORS, lives: 3 });
    const result = game.applyColor("red");
    assert.equal(result.outcome, Outcome.Locked);
    assert.equal(game.state.lives, 3);
  });

  test("unlockColor ignora id inexistente e repetido", () => {
    const game = new Game({ puzzles: PUZZLES, colors: COLORS });
    assert.equal(game.unlockColor("green"), true);
    assert.equal(game.unlockColor("green"), false);
    assert.equal(game.unlockColor("ciano"), false);
  });

  test("cor certa resolve o enigma e revela a palavra", () => {
    const game = newGame();
    const result = game.applyColor("green");
    assert.equal(result.outcome, Outcome.Solved);
    assert.equal(result.word, "primeira");
    assert.deepEqual(game.state.revealedWords, ["primeira"]);
  });

  test("enigma de duas cores pede as duas", () => {
    const game = newGame();
    game.applyColor("green");
    game.advance();

    assert.equal(game.applyColor("red").outcome, Outcome.Partial);
    assert.equal(game.applyColor("blue").outcome, Outcome.Solved);
    assert.equal(game.phrase, "primeira segunda");
  });

  test("a ordem das cores não importa", () => {
    const game = newGame();
    game.applyColor("green");
    game.advance();
    assert.equal(game.applyColor("blue").outcome, Outcome.Partial);
    assert.equal(game.applyColor("red").outcome, Outcome.Solved);
  });

  test("repetir uma cor já aplicada não resolve o enigma sozinho", () => {
    const game = newGame();
    game.applyColor("green");
    game.advance();
    game.applyColor("red");
    const repeat = game.applyColor("red");
    assert.equal(repeat.outcome, Outcome.AlreadyApplied);
    assert.equal(game.state.appliedColors.length, 1);
  });

  test("cor errada custa uma vida", () => {
    const game = newGame();
    const result = game.applyColor("red");
    assert.equal(result.outcome, Outcome.Wrong);
    assert.equal(result.livesLeft, 2);
  });

  test("a mesma cor errada não custa vida duas vezes", () => {
    const game = newGame();
    game.applyColor("red");
    const again = game.applyColor("red");
    assert.equal(again.outcome, Outcome.AlreadyRejected);
    assert.equal(game.state.lives, 2);
  });

  test("zerar as vidas encerra a partida", () => {
    const game = newGame();
    game.applyColor("red");
    game.applyColor("blue");
    const last = game.applyColor("red");
    assert.equal(last.outcome, Outcome.AlreadyRejected);

    const fresh = newGame({ lives: 2 });
    fresh.applyColor("red");
    const over = fresh.applyColor("blue");
    assert.equal(over.outcome, Outcome.GameOver);
    assert.equal(fresh.state.status, Status.GameOver);
    assert.equal(fresh.state.lives, 0);
  });

  test("depois do fim de jogo nada mais é aceito", () => {
    const game = newGame({ lives: 1 });
    game.applyColor("red");
    assert.equal(game.applyColor("green").outcome, Outcome.Ignored);
    assert.deepEqual(game.state.revealedWords, []);
  });

  test("resolver o último enigma completa a partida", () => {
    const game = newGame();
    game.applyColor("green");
    assert.equal(game.advance(), Status.Playing);
    game.applyColor("red");
    game.applyColor("blue");
    assert.equal(game.advance(), Status.Complete);
    assert.equal(game.phrase, "primeira segunda");
  });

  test("avançar limpa as cores aplicadas e as recusadas do enigma anterior", () => {
    const game = newGame();
    game.applyColor("red"); // errada aqui
    game.applyColor("green");
    game.advance();
    assert.deepEqual(game.state.appliedColors, []);
    // "red" é a cor certa no segundo enigma, mesmo tendo sido recusada no primeiro.
    assert.equal(game.applyColor("red").outcome, Outcome.Partial);
  });

  test("recomeçar zera o progresso mas mantém as cores já lidas no sensor", () => {
    const game = newGame();
    game.applyColor("green");
    game.advance();
    game.restart();

    const state = game.state;
    assert.equal(state.status, Status.Playing);
    assert.equal(state.lives, 3);
    assert.equal(state.puzzleIndex, 0);
    assert.deepEqual(state.revealedWords, []);
    assert.deepEqual(state.unlockedColors.sort(), ["blue", "green", "red"]);
  });

  test("state é uma cópia: mexer nela não afeta o jogo", () => {
    const game = newGame();
    const state = game.state;
    state.revealedWords.push("intruso");
    state.unlockedColors.pop();
    assert.deepEqual(game.state.revealedWords, []);
    assert.equal(game.state.unlockedColors.length, 3);
  });
});
