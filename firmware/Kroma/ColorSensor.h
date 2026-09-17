// =============================================================================
// Kroma - camada de aquisicao sobre o TCS34725.
//
// Responsabilidades:
//   * ajustar ganho e tempo de integracao automaticamente (AGC);
//   * compensar a componente infravermelha que o sensor enxerga;
//   * converter contagens brutas em valores lineares balanceados pelo branco;
//   * calcular lux e temperatura de cor.
// =============================================================================
#ifndef KROMA_COLOR_SENSOR_H
#define KROMA_COLOR_SENSOR_H

#include <Adafruit_TCS34725.h>
#include <Wire.h>
#include <stdint.h>

namespace kroma {

// Ganho de canal aplicado antes da classificacao. Corrige tanto a resposta
// desigual dos filtros do sensor quanto a temperatura do LED de iluminacao.
struct WhiteBalance {
  float r = 1.0f;
  float g = 1.0f;
  float b = 1.0f;

  bool isValid() const { return r > 0.0f && g > 0.0f && b > 0.0f; }
};

struct SensorSample {
  // Contagens brutas dos quatro canais.
  uint16_t r = 0;
  uint16_t g = 0;
  uint16_t b = 0;
  uint16_t c = 0;
  // Canais apos compensacao de IR.
  uint16_t rComp = 0;
  uint16_t gComp = 0;
  uint16_t bComp = 0;
  uint16_t cComp = 0;
  uint16_t ir = 0;
  // Canais lineares normalizados pelo branco calibrado (1.0 == branco).
  float rLinear = 0.0f;
  float gLinear = 0.0f;
  float bLinear = 0.0f;
  // Metadados da aquisicao.
  uint16_t gain = 1;
  uint16_t integrationMs = 0;
  uint16_t saturation = 0;
  bool saturated = false;
  float lux = 0.0f;
  float colorTemperature = 0.0f;
};

class ColorSensor {
 public:
  ColorSensor() = default;

  // Inicializa o sensor no barramento indicado. Retorna false se o TCS34725
  // nao responder; nesse caso nenhuma outra chamada e valida.
  bool begin(TwoWire* wire);

  // Faz uma leitura completa (inclui reajuste de ganho quando necessario).
  SensorSample read();

  bool isAvailable() const { return available_; }

  const WhiteBalance& whiteBalance() const { return whiteBalance_; }
  void setWhiteBalance(const WhiteBalance& balance);

  // Usa a amostra recebida como nova referencia de branco. Retorna false se a
  // amostra for escura demais para servir de referencia.
  bool calibrateWhiteFrom(const SensorSample& sample);

  // Volta aos ganhos de canal padrao definidos em Config.h.
  void resetWhiteBalance();

 private:
  void applyGainAndIntegration();
  void readRaw();
  // Reajusta ganho/integracao ate a contagem clear cair na janela util.
  void autoAdjust();

  Adafruit_TCS34725 tcs_;
  WhiteBalance whiteBalance_;
  uint8_t agcIndex_ = 0;
  uint16_t gain_ = 1;
  uint8_t integrationRegister_ = 0;
  uint16_t integrationMs_ = 0;
  uint16_t raw_[4] = {0, 0, 0, 0};  // r, g, b, c
  bool available_ = false;
};

}  // namespace kroma

#endif  // KROMA_COLOR_SENSOR_H
