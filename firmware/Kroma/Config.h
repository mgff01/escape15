// =============================================================================
// Kroma - configuracao de hardware e de comportamento do firmware.
//
// Este e o unico arquivo que precisa ser editado para adaptar o Kroma a uma
// montagem diferente (outros pinos, outro display, outra cadencia de leitura).
// =============================================================================
#ifndef KROMA_CONFIG_H
#define KROMA_CONFIG_H

#include <stdint.h>

namespace kroma {
namespace config {

// --- Barramento I2C 0: display OLED SSD1306 128x64 -------------------------
constexpr int kOledSdaPin = 21;
constexpr int kOledSclPin = 22;
constexpr uint32_t kOledFrequency = 400000;

// --- Barramento I2C 1: sensor de cor TCS34725 ------------------------------
// O sensor fica em um barramento proprio para nao disputar tempo com o
// display, que e atualizado a cada quadro.
constexpr int kSensorSdaPin = 25;
constexpr int kSensorSclPin = 26;
constexpr uint32_t kSensorFrequency = 100000;

// --- LED branco de iluminacao da amostra -----------------------------------
constexpr int kLedPin = 4;
constexpr bool kLedActiveHigh = true;
// Tempo entre ligar o LED e a primeira leitura valida.
constexpr uint32_t kLedWarmupMs = 300;

// --- Cadencia -------------------------------------------------------------
// Intervalo alvo entre amostras. O loop nunca bloqueia: se a integracao do
// sensor demorar mais que isso, a proxima amostra simplesmente sai atrasada.
constexpr uint32_t kSampleIntervalMs = 250;
// Quantas leituras consecutivas precisam concordar antes de anunciar uma cor
// nova. Evita que ruido na borda entre duas faixas de matiz gere piscadas.
constexpr uint8_t kStableSamplesRequired = 3;
// Mesmo sem mudanca de cor, reenvia o estado atual nesse intervalo para que um
// cliente que conectou depois receba algo sem precisar esperar.
constexpr uint32_t kHeartbeatMs = 5000;

// --- Serial ---------------------------------------------------------------
constexpr uint32_t kSerialBaud = 115200;

// --- Calibracao de branco --------------------------------------------------
// Referencia de branco em "contagens por ms por unidade de ganho", a unidade
// que ColorSensor usa para ficar independente do ajuste automatico de ganho.
// Estes sao apenas valores tipicos do modulo com o LED branco a ~1 cm de papel
// sulfite: rode o comando "w" apontando para o branco da sua montagem para
// gravar a calibracao real na NVS.
constexpr float kDefaultWhiteR = 22.0f;
constexpr float kDefaultWhiteG = 24.0f;
constexpr float kDefaultWhiteB = 18.0f;
// Namespace da NVS (Preferences) onde a calibracao e persistida.
constexpr char kPreferencesNamespace[] = "kroma";

}  // namespace config
}  // namespace kroma

#endif  // KROMA_CONFIG_H
