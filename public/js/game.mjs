/**
 * Motor do jogo.
 *
 * Sem nenhuma referência a DOM, socket ou timer: recebe uma ação, devolve o que
 * aconteceu. Isso é o que permite testar as regras com `npm test` (ver
 * tests/game.test.mjs) em vez de depender de clicar na tela.
 */

export const Status = Object.freeze({
  Playing: "playing",
  GameOver: "game-over",
  Complete: "complete",
});

export const Outcome = Object.freeze({
  /** A partida já acabou; nada foi alterado. */
  Ignored: "ignored",
  /** A cor ainda não foi lida no sensor. */
  Locked: "locked",
  /** Cor certa que já havia sido aplicada neste enigma. */
  AlreadyApplied: "already-applied",
  /** Cor errada que já havia sido recusada neste enigma: não custa vida de novo. */
  AlreadyRejected: "already-rejected",
  /** Cor errada: custou uma vida. */
  Wrong: "wrong",
  /** Cor errada que zerou as vidas. */
  GameOver: "game-over",
  /** Cor certa, mas o enigma ainda precisa de outra. */
  Partial: "partial",
  /** Enigma completo. */
  Solved: "solved",
});

export class Game {
  /**
   * @param {object} options
   * @param {Array} options.puzzles lista de enigmas
   * @param {object} options.colors paleta, no formato { id: { name, hex } }
   * @param {number} [options.lives] tentativas antes do fim de jogo
   */
  constructor({ puzzles, colors, lives = 3 }) {
    if (!Array.isArray(puzzles) || puzzles.length === 0) {
      throw new Error("Game precisa de pelo menos um enigma.");
    }
    this.puzzles = puzzles;
    this.colors = colors;
    this.initialLives = lives;
    // As cores destravadas sobrevivem ao recomeço de propósito: quem já leu uma
    // amostra no sensor não precisa ler de novo depois de perder.
    this.unlockedColors = new Set();
    this.restart();
  }

  restart() {
    this.status = Status.Playing;
    this.lives = this.initialLives;
    this.puzzleIndex = 0;
    this.revealedWords = [];
    this.appliedColors = [];
    this.rejectedColors = new Set();
  }

  get currentPuzzle() {
    return this.puzzles[this.puzzleIndex] ?? null;
  }

  get phrase() {
    return this.revealedWords.join(" ");
  }

  isUnlocked(colorId) {
    return this.unlockedColors.has(colorId);
  }

  /**
   * Marca uma cor como disponível na paleta.
   * @returns {boolean} true se ela ainda não estava destravada.
   */
  unlockColor(colorId) {
    if (!Object.hasOwn(this.colors, colorId) || this.unlockedColors.has(colorId)) {
      return false;
    }
    this.unlockedColors.add(colorId);
    return true;
  }

  /**
   * Aplica uma cor ao enigma atual.
   * @returns {{outcome: string, word?: string, livesLeft: number}}
   */
  applyColor(colorId) {
    if (this.status !== Status.Playing) {
      return { outcome: Outcome.Ignored, livesLeft: this.lives };
    }
    if (!this.unlockedColors.has(colorId)) {
      return { outcome: Outcome.Locked, livesLeft: this.lives };
    }

    const puzzle = this.currentPuzzle;
    const isRequired = puzzle.requiredColors.includes(colorId);

    if (!isRequired) {
      // Soltar a mesma cor errada duas vezes costuma ser escorregão de mouse, e
      // não uma nova tentativa: só a primeira custa vida.
      if (this.rejectedColors.has(colorId)) {
        return { outcome: Outcome.AlreadyRejected, livesLeft: this.lives };
      }
      this.rejectedColors.add(colorId);
      this.lives -= 1;
      if (this.lives <= 0) {
        this.lives = 0;
        this.status = Status.GameOver;
        return { outcome: Outcome.GameOver, livesLeft: 0 };
      }
      return { outcome: Outcome.Wrong, livesLeft: this.lives };
    }

    if (this.appliedColors.includes(colorId)) {
      return { outcome: Outcome.AlreadyApplied, livesLeft: this.lives };
    }

    this.appliedColors.push(colorId);
    if (this.appliedColors.length < puzzle.requiredColors.length) {
      return { outcome: Outcome.Partial, livesLeft: this.lives };
    }

    this.revealedWords.push(puzzle.revealedWord);
    return { outcome: Outcome.Solved, word: puzzle.revealedWord, livesLeft: this.lives };
  }

  /**
   * Avança para o próximo enigma (ou encerra a partida, se era o último).
   * Chamado pela interface depois da animação de acerto.
   */
  advance() {
    if (this.status !== Status.Playing) return this.status;

    if (this.puzzleIndex + 1 >= this.puzzles.length) {
      this.status = Status.Complete;
      return this.status;
    }

    this.puzzleIndex += 1;
    this.appliedColors = [];
    this.rejectedColors = new Set();
    return this.status;
  }

  /** Retrato imutável do estado, para a interface desenhar. */
  get state() {
    return {
      status: this.status,
      lives: this.lives,
      maxLives: this.initialLives,
      puzzleIndex: this.puzzleIndex,
      totalPuzzles: this.puzzles.length,
      currentPuzzle: this.currentPuzzle,
      appliedColors: [...this.appliedColors],
      unlockedColors: [...this.unlockedColors],
      revealedWords: [...this.revealedWords],
      phrase: this.phrase,
    };
  }
}
