/**
 * Ligação com o servidor: recebe as cores lidas pelo Kroma.
 *
 * O socket.io é carregado pelo próprio servidor (/socket.io/socket.io.js). Se a
 * página for aberta direto do disco, ele não existe — e nesse caso o jogo
 * precisa continuar jogável pelo painel do apresentador, em vez de quebrar.
 */
export function connectToServer({ onColor, onStatus, onDeviceMessage }) {
  if (typeof window.io !== "function") {
    onStatus({ state: "offline", detail: "abra pelo servidor (npm start)" });
    return null;
  }

  const socket = window.io();

  socket.on("connect", () => onStatus({ state: "connecting", detail: "aguardando a placa" }));
  socket.on("disconnect", () => onStatus({ state: "offline", detail: "servidor caiu" }));
  socket.on("connect_error", (error) => onStatus({ state: "offline", detail: error.message }));

  socket.on("source-status", (status) => onStatus(status));
  socket.on("color", (color) => onColor(color));
  socket.on("device-message", (message) => onDeviceMessage?.(message));

  return socket;
}
