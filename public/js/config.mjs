/**
 * Conteúdo do jogo: paleta, enigmas e textos.
 *
 * Tudo que um organizador do evento pode querer trocar (uma marca, uma palavra,
 * o número de vidas) está aqui, separado da lógica e da interface.
 */

/** Cores da paleta, na ordem em que aparecem. */
export const COLORS = {
  purple: { name: "Magenta", hex: "#FF00FF", sensorName: "Magenta" },
  green: { name: "Verde", hex: "#009739", sensorName: "Verde" },
  blue: { name: "Azul", hex: "#0064E0", sensorName: "Azul" },
  black: { name: "Preto", hex: "#111111", sensorName: "Preto" },
  red: { name: "Vermelho", hex: "#D92E2E", sensorName: "Vermelho" },
  orange: { name: "Laranja", hex: "#FF8C00", sensorName: "Laranja" },
  yellow: { name: "Amarelo", hex: "#FDB913", sensorName: "Amarelo" },
};

/**
 * De volta do sensor: nome que a placa envia -> id da paleta.
 *
 * Derivado de COLORS para os dois nunca saírem de sincronia. A versão anterior
 * mantinha a tabela na mão e tinha entradas que não existiam na paleta
 * ("Ciano" apontava para um id inexistente), então a leitura era silenciosamente
 * descartada.
 */
export const SENSOR_NAME_TO_COLOR_ID = Object.fromEntries(
  Object.entries(COLORS).map(([id, color]) => [color.sensorName, id]),
);

/** Cores que o sensor lê mas que não fazem parte do jogo. */
export const IGNORED_SENSOR_NAMES = new Set(["Branco", "Cinza", "Ciano"]);

export const LIVES = 3;

export const PUZZLES = [
  {
    brandName: "Meta",
    logoFile: "images/meta.png",
    requiredColors: ["orange"],
    revealedWord: "Nova",
  },
  {
    brandName: "Michelin",
    logoFile: "images/michelin.jpeg",
    requiredColors: ["black", "purple"],
    revealedWord: "bebida",
  },
  {
    brandName: "Zona Sul",
    logoFile: "images/zonasul.png",
    requiredColors: ["green"],
    revealedWord: "sustentável",
  },
  {
    brandName: "Parmê",
    logoFile: "images/parme.png",
    requiredColors: ["green", "purple"],
    revealedWord: "feito com",
  },
  {
    brandName: "Americanas",
    logoFile: "images/americanas.webp",
    requiredColors: ["green"],
    revealedWord: "Guaraná da Amazônia.",
  },
];

export const UNIVERSAL_HINT = `
  <p>Talvez você deva pensar ao contrário — ou melhor dizendo, no que for
  <em>complementar</em>.</p>
  <p><strong>Observação:</strong> algumas marcas têm duas cores, e nesses casos
  as duas são necessárias.</p>
`;
