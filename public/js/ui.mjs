/**
 * Camada de interface: tudo que toca no DOM mora aqui.
 *
 * Não conhece as regras do jogo — recebe um retrato do estado e desenha. Isso
 * mantém a lógica (game.mjs) testável e deixa uma mudança visual restrita a
 * este arquivo e ao CSS.
 */

const HEART_ICON =
  '<svg class="heart-icon" viewBox="0 0 24 24" focusable="false"><path d="M12 21s-6.7-4.35-9.3-8.4C1.1 10.2 1.6 6.9 4.2 5.3c2.2-1.35 4.9-.7 6.3 1.2.4.5.8 1.1 1.1 1.6.3-.5.7-1.1 1.1-1.6 1.4-1.9 4.1-2.55 6.3-1.2 2.6 1.6 3.1 4.9 1.5 7.3C18.7 16.65 12 21 12 21Z" /></svg>';

const SUN_ICON =
  '<svg class="theme-icon" viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="5" /><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="23" /><line x1="1" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="23" y2="12" /><line x1="4.2" y1="4.2" x2="6.3" y2="6.3" /><line x1="17.7" y1="17.7" x2="19.8" y2="19.8" /><line x1="4.2" y1="19.8" x2="6.3" y2="17.7" /><line x1="17.7" y1="6.3" x2="19.8" y2="4.2" /></g></svg>';

const MOON_ICON =
  '<svg class="theme-icon" viewBox="0 0 24 24" focusable="false"><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z" /></svg>';

const CONNECTION_LABELS = {
  connecting: "Conectando…",
  connected: "Kroma conectado",
  searching: "Procurando a placa…",
  disconnected: "Kroma desconectado",
  mock: "Modo demonstração",
  offline: "Servidor fora do ar",
};

function byId(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elemento #${id} não encontrado no HTML.`);
  return element;
}

export class UI {
  constructor({ colors, onApplyColor, onRestart, onUnlockColor }) {
    this.colors = colors;
    this.onApplyColor = onApplyColor;
    this.onRestart = onRestart;
    this.onUnlockColor = onUnlockColor;
    this.selectedColorId = null;
    this.toastTimer = null;

    this.el = {
      palette: byId("color-palette"),
      dropzone: byId("logo-container"),
      brandName: byId("brand-name"),
      chips: byId("applied-colors-container"),
      words: byId("revealed-words"),
      lives: byId("lives-counter"),
      counter: byId("puzzle-counter"),
      progress: byId("progress-bar"),
      themeToggle: byId("theme-toggle"),
      themeToggleIcon: byId("theme-toggle-icon"),
      hintButton: byId("hint-button"),
      hintModal: byId("hint-modal"),
      hintText: byId("hint-text"),
      gameOverModal: byId("game-over-modal"),
      restartButton: byId("restart-button"),
      victoryModal: byId("victory-modal"),
      victoryPhrase: byId("victory-phrase"),
      playAgainButton: byId("play-again-button"),
      toast: byId("toast"),
      connectionLight: document.querySelector(".status-dot__light"),
      connectionText: byId("connection-text"),
      devpanel: byId("devpanel"),
      devpanelButtons: byId("devpanel-buttons"),
      devpanelClose: byId("devpanel-close"),
      devConnection: byId("dev-connection"),
      devLastColor: byId("dev-last-color"),
    };

    this.bindStaticEvents();
    this.buildDevPanel();
    this.syncThemeToggle();
  }

  bindStaticEvents() {
    const {
      dropzone,
      themeToggle,
      hintButton,
      hintModal,
      restartButton,
      playAgainButton,
      devpanelClose,
    } = this.el;

    themeToggle.addEventListener("click", () => this.toggleTheme());

    // Seleção por clique: primeiro clique escolhe a cor na paleta, segundo
    // clique (na mesma cor ou no logo) aplica. Substitui o arrastar, que não
    // funcionava de forma confiável em toque nem com teclado.
    dropzone.addEventListener("click", () => this.applySelection());
    dropzone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.applySelection();
      }
    });

    hintButton.addEventListener("click", () => this.openModal(hintModal));
    restartButton.addEventListener("click", () => {
      this.closeModal(this.el.gameOverModal);
      this.onRestart();
    });
    playAgainButton.addEventListener("click", () => {
      this.closeModal(this.el.victoryModal);
      this.onRestart();
    });

    devpanelClose.addEventListener("click", () => this.toggleDevPanel(false));
    document.addEventListener("keydown", (event) => {
      if (event.key.toLowerCase() === "d" && (event.ctrlKey || event.metaKey) && event.altKey) {
        event.preventDefault();
        this.toggleDevPanel();
      }
    });
  }

  applySelection() {
    if (!this.selectedColorId) {
      this.toast("Escolha uma cor na paleta primeiro.", "info");
      return;
    }
    this.onApplyColor(this.selectedColorId);
  }

  setHint(html) {
    this.el.hintText.innerHTML = html;
  }

  /* -------------------------------------------------------------- tema ---- */

  toggleTheme() {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch (e) {
      // Armazenamento indisponível (ex.: navegação privada): o tema vale só para esta sessão.
    }
    this.syncThemeToggle();
  }

  syncThemeToggle() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    this.el.themeToggle.setAttribute("aria-pressed", String(isDark));
    this.el.themeToggleIcon.innerHTML = isDark ? SUN_ICON : MOON_ICON;
  }

  /* ---------------------------------------------------------------- paleta */

  renderPalette(state) {
    const unlocked = new Set(state.unlockedColors);
    this.el.palette.replaceChildren();

    for (const [colorId, color] of Object.entries(this.colors)) {
      const isUnlocked = unlocked.has(colorId);
      const item = document.createElement("li");

      const button = document.createElement("button");
      button.type = "button";
      button.className = "swatch";
      button.dataset.colorId = colorId;
      button.style.setProperty("--swatch-color", color.hex);
      button.setAttribute("aria-pressed", String(this.selectedColorId === colorId));
      button.disabled = !isUnlocked;
      button.classList.toggle("is-locked", !isUnlocked);
      button.classList.toggle("is-selected", this.selectedColorId === colorId);
      button.setAttribute(
        "aria-label",
        isUnlocked ? color.name : `${color.name} (ainda não lida no sensor)`,
      );

      const dot = document.createElement("span");
      dot.className = "swatch__dot";
      dot.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.className = "swatch__name";
      label.textContent = color.name;
      button.append(dot, label);

      if (isUnlocked) {
        button.addEventListener("click", () => this.select(colorId, state));
      }

      item.append(button);
      this.el.palette.append(item);
    }
  }

  /**
   * Primeiro clique numa cor a seleciona; clicar de novo na mesma cor já
   * selecionada aplica ela ao logo — dois cliques bastam, sem precisar
   * arrastar.
   */
  select(colorId, state) {
    if (this.selectedColorId === colorId) {
      this.onApplyColor(colorId);
      return;
    }
    this.selectedColorId = colorId;
    this.renderPalette(state);
  }

  clearSelection(state) {
    this.selectedColorId = null;
    this.renderPalette(state);
  }

  /** Destaca uma cor recém-destravada para ninguém perder a novidade. */
  highlightColor(colorId) {
    const swatch = this.el.palette.querySelector(`[data-color-id="${colorId}"]`);
    if (!swatch) return;
    swatch.classList.add("is-new");
    swatch.addEventListener("animationend", () => swatch.classList.remove("is-new"), {
      once: true,
    });
  }

  /* ----------------------------------------------------------------- mesa */

  renderPuzzle(state) {
    const puzzle = state.currentPuzzle;
    this.el.chips.replaceChildren();

    if (!puzzle) {
      this.el.dropzone.replaceChildren();
      this.el.brandName.textContent = "";
      return;
    }

    this.el.brandName.textContent = puzzle.brandName;

    const image = document.createElement("img");
    image.className = "dropzone__logo";
    image.alt = `Logo da marca ${puzzle.brandName}`;
    image.src = puzzle.logoFile;
    image.draggable = false;
    // Os logos vêm de sites de terceiros: qualquer um deles pode sair do ar no
    // dia do evento, e aí o jogo mostra o nome da marca em vez de um ícone
    // quebrado.
    image.addEventListener("error", () => {
      const fallback = document.createElement("div");
      fallback.className = "dropzone__fallback";
      fallback.textContent = puzzle.brandName;
      this.el.dropzone.replaceChildren(fallback);
    });

    this.el.dropzone.replaceChildren(image);
    this.el.dropzone.classList.remove("is-solved");
  }

  renderChips(state) {
    this.el.chips.replaceChildren();
    for (const colorId of state.appliedColors) {
      const color = this.colors[colorId];
      if (!color) continue;
      const chip = document.createElement("li");
      chip.className = "chip";
      chip.style.setProperty("--chip-color", color.hex);
      chip.title = color.name;
      const label = document.createElement("span");
      label.className = "sr-only";
      label.textContent = color.name;
      chip.append(label);
      this.el.chips.append(chip);
    }
  }

  renderMeters(state) {
    this.el.counter.textContent = `${Math.min(state.puzzleIndex + 1, state.totalPuzzles)}/${state.totalPuzzles}`;

    this.el.lives.replaceChildren();
    for (let i = 0; i < state.maxLives; i += 1) {
      const heart = document.createElement("span");
      heart.className = i < state.lives ? "heart" : "heart heart--lost";
      heart.innerHTML = HEART_ICON;
      this.el.lives.append(heart);
    }
    this.el.lives.setAttribute("aria-label", `${state.lives} de ${state.maxLives} vidas`);

    const solved = state.revealedWords.length;
    this.el.progress.style.width = `${(solved / state.totalPuzzles) * 100}%`;
  }

  renderWords(state) {
    this.el.words.textContent = state.phrase || "—";
  }

  render(state) {
    this.renderPalette(state);
    this.renderPuzzle(state);
    this.renderChips(state);
    this.renderMeters(state);
    this.renderWords(state);
  }

  markSolved() {
    this.el.dropzone.classList.add("is-solved");
  }

  shake() {
    const { dropzone } = this.el;
    dropzone.classList.remove("is-wrong");
    // Reinicia a animação mesmo quando o erro se repete no mesmo enigma.
    void dropzone.offsetWidth;
    dropzone.classList.add("is-wrong");
    dropzone.addEventListener("animationend", () => dropzone.classList.remove("is-wrong"), {
      once: true,
    });
  }

  /* --------------------------------------------------------------- avisos */

  toast(message, tone = "info") {
    const { toast } = this.el;
    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.classList.add("is-visible");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  setConnection(state, detail = "") {
    const label = CONNECTION_LABELS[state] || state;
    this.el.connectionLight.dataset.state = state;
    this.el.connectionText.textContent = label;
    this.el.devConnection.textContent = detail ? `${label} — ${detail}` : label;
  }

  setLastReading(text) {
    this.el.devLastColor.textContent = text;
  }

  openModal(dialog) {
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  closeModal(dialog) {
    if (typeof dialog.close === "function") {
      if (dialog.open) dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  showGameOver() {
    this.openModal(this.el.gameOverModal);
  }

  showVictory(phrase) {
    this.el.victoryPhrase.textContent = phrase;
    this.openModal(this.el.victoryModal);
  }

  /* ------------------------------------------- painel do apresentador */

  buildDevPanel() {
    for (const [colorId, color] of Object.entries(this.colors)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "devpanel__color";
      button.style.setProperty("--swatch-color", color.hex);
      button.textContent = color.name;
      button.addEventListener("click", () => this.onUnlockColor(colorId));
      this.el.devpanelButtons.append(button);
    }
  }

  toggleDevPanel(force) {
    const shouldShow = force ?? this.el.devpanel.hidden;
    this.el.devpanel.hidden = !shouldShow;
  }
}
