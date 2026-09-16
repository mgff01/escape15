# Enigma das Marcas

Jogo do **IBMEC Day**: cada logo perdeu a cor, e a paleta só libera uma cor
depois que ela for lida de verdade no [Kroma](https://github.com/mgff01/Kroma),
o leitor de cores em ESP32. Acertando as cores de todos os logos, a frase
escondida aparece.

<img width="1759" height="1057" alt="Tela do jogo" src="https://github.com/user-attachments/assets/310c2fe8-77d5-41f4-89de-fc3634138000" />

## Rodando

```bash
npm install
npm start
```

Depois abra <http://localhost:3000>.

### Sem a placa por perto

```bash
npm run mock
```

O modo demonstração gera cores sozinho, então dá para testar, apresentar e
desenvolver o jogo inteiro sem o hardware.

### Configuração

Tudo por variável de ambiente — não é mais preciso editar o código para trocar
a porta serial, como acontecia com o `"COM12"` que ficava fixo no `server.js`.

| Variável | Padrão | Para que serve |
| -------- | ------ | -------------- |
| `PORT` | `3000` | Porta HTTP do jogo |
| `SERIAL_PORT` | *(vazio)* | Porta da placa (`COM5`, `/dev/ttyUSB0`). Vazio = detectar sozinho |
| `BAUD_RATE` | `115200` | Velocidade da serial |
| `MOCK` | — | `1` liga o modo demonstração |
| `LOG_LEVEL` | `info` | `debug` mostra cada linha recebida da serial |

Exemplo:

```bash
SERIAL_PORT=/dev/ttyUSB0 PORT=8080 npm start
```

Quando `SERIAL_PORT` não é informado, o servidor lista as portas do sistema e
escolhe a primeira cujo fabricante seja um conversor USB-serial conhecido
(CP210x, CH340, FTDI, USB nativo do ESP32). Se a placa não estiver ligada, ele
segue tentando com backoff, e conecta sozinho assim que ela aparecer — não é
preciso reiniciar o servidor.

## Como jogar

1. Encoste uma amostra colorida no sensor do Kroma. A cor correspondente
   destrava na paleta.
2. Arraste a cor até o logo — ou selecione a cor e aperte <kbd>Enter</kbd> sobre
   o logo, que é como funciona no celular e no teclado.
3. Cada logo pede uma ou duas cores. Errar custa uma vida; são três.
4. Com todos os logos coloridos, a frase completa aparece.

O botão <kbd>?</kbd> mostra a dica.

### Painel do apresentador

<kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>D</kbd> abre um painel com o estado da
conexão, a última leitura e botões para destravar cores na mão. É a rede de
segurança para quando o sensor falha no meio da apresentação.

## Estrutura

```
src/
  server.js      HTTP + WebSocket; junta a fonte de cores aos navegadores
  colorSource.js serial (com reconexão) e o gerador do modo demonstração
  protocol.js    leitura do protocolo do Kroma (JSON Lines e formato antigo)
  config.js      variáveis de ambiente e argumentos
  logger.js      log com nível e horário
public/
  index.html
  css/styles.css
  js/config.mjs     conteúdo: paleta, enigmas, textos
  js/game.mjs       regras do jogo, sem DOM — é o que os testes cobrem
  js/ui.mjs         tudo que toca na tela
  js/connection.mjs socket.io
  js/main.mjs       liga as três partes
tests/           testes do protocolo, das regras e do servidor
```

A separação entre `game.mjs` (regras) e `ui.mjs` (tela) é o ponto central: antes
as duas coisas viviam no mesmo arquivo, então não dava para verificar se "errar
três vezes encerra a partida" sem clicar na tela três vezes.

## Testes

```bash
npm test
```

Cobrem o parser do protocolo (incluindo linha truncada, cor desconhecida e o
formato antigo), as regras do jogo (vidas, cores repetidas, ordem das cores,
recomeço) e a subida do servidor com `/api/health`.

## Comunicação com a placa

O servidor lê a serial e repassa cada leitura por WebSocket:

| Evento | Direção | Conteúdo |
| ------ | ------- | -------- |
| `color` | servidor → navegador | `{ name, hex, rgb, saturated, lux, receivedAt }` |
| `source-status` | servidor → navegador | `{ state, detail }` — `connected`, `searching`, `disconnected`, `mock` |
| `device-message` | servidor → navegador | logs e status vindos do firmware |

`GET /api/health` devolve o mesmo estado em JSON, útil para conferir se a placa
está conectada sem abrir o navegador.

O formato das linhas seriais está documentado em
[`docs/PROTOCOL.md`](https://github.com/mgff01/Kroma/blob/main/docs/PROTOCOL.md)
no repositório do Kroma. O firmware antigo, que mandava só o nome da cor,
continua funcionando.

## Solução de problemas

| Sintoma | O que fazer |
| ------- | ----------- |
| "Kroma desconectado" | Confira o cabo. O servidor reconecta sozinho quando a placa voltar. |
| "Procurando a placa…" | Informe a porta explicitamente: `SERIAL_PORT=COM5 npm start`. |
| "abra pelo servidor (npm start)" | A página foi aberta como arquivo. Use <http://localhost:3000>. |
| `EADDRINUSE` | Outro servidor já usa a porta: `PORT=3001 npm start`. |
| Cores não destravam | Rode com `LOG_LEVEL=debug` e veja se as linhas chegam; talvez o sensor precise de calibração (comando `w`). |
| Logo aparece como texto | O site que hospeda a imagem saiu do ar; o jogo segue jogável com o nome da marca. |
