#include "ColorSensor.h"

#include <Arduino.h>

#include "Config.h"

namespace kroma {
namespace {

// Coeficientes do application note DN40 da AMS para o TCS34725.
constexpr float kLuxCoefR = 0.136f;
constexpr float kLuxCoefG = 1.000f;
constexpr float kLuxCoefB = -0.444f;
constexpr float kGlassAttenuation = 1.0f;
constexpr float kDeviceFactor = 310.0f;
constexpr float kCtCoef = 3810.0f;
constexpr float kCtOffset = 1391.0f;

struct AgcStep {
  tcs34725Gain_t gain;
  // Mantido como o enum da biblioteca, e nao como uint8_t, porque C++ nao
  // converte inteiro em enum implicitamente: setIntegrationTime() recebe o
  // tipo enumerado.
  tcs34725IntegrationTime_t integration;
  uint16_t gainx;        // ganho em vezes
  uint16_t minCount;     // abaixo disso, sobe um degrau de sensibilidade
  uint16_t maxCount;     // acima disso, desce um degrau (0 == sem limite)
};

// Do mais sensivel (indice 0) ao menos sensivel. O AGC caminha nessa lista.
constexpr AgcStep kAgcSteps[] = {
    {TCS34725_GAIN_60X, TCS34725_INTEGRATIONTIME_614MS, 60, 0, 20000},
    {TCS34725_GAIN_60X, TCS34725_INTEGRATIONTIME_154MS, 60, 4990, 63000},
    {TCS34725_GAIN_16X, TCS34725_INTEGRATIONTIME_154MS, 16, 16790, 63000},
    {TCS34725_GAIN_4X, TCS34725_INTEGRATIONTIME_154MS, 4, 15740, 63000},
    {TCS34725_GAIN_1X, TCS34725_INTEGRATIONTIME_154MS, 1, 15740, 0},
};

constexpr uint8_t kAgcStepCount = sizeof(kAgcSteps) / sizeof(kAgcSteps[0]);
// Teto de iteracoes do AGC por leitura: a lista tem cinco degraus, entao
// atravessa-la inteira uma vez basta. Sem esse teto, ruido na fronteira entre
// dois degraus faria o ajuste oscilar indefinidamente.
constexpr uint8_t kMaxAgcIterations = kAgcStepCount;

uint16_t integrationMillis(uint8_t atime) {
  return static_cast<uint16_t>((256 - atime) * 2.4f);
}

uint16_t saturationFor(uint8_t atime) {
  const uint16_t steps = static_cast<uint16_t>(256 - atime);
  return (steps > 63) ? 65535 : static_cast<uint16_t>(1024 * steps);
}

// Subtracao saturada: os canais compensados nunca podem ficar negativos, e em
// aritmetica sem sinal isso viraria um valor gigante.
uint16_t subtractClamped(uint16_t value, uint16_t amount) {
  return (value > amount) ? static_cast<uint16_t>(value - amount) : 0;
}

}  // namespace

bool ColorSensor::begin(TwoWire* wire) {
  whiteBalance_.r = config::kDefaultWhiteR;
  whiteBalance_.g = config::kDefaultWhiteG;
  whiteBalance_.b = config::kDefaultWhiteB;

  agcIndex_ = 0;
  tcs_ = Adafruit_TCS34725(kAgcSteps[agcIndex_].integration, kAgcSteps[agcIndex_].gain);
  available_ = tcs_.begin(TCS34725_ADDRESS, wire);
  if (available_) {
    applyGainAndIntegration();
  }
  return available_;
}

void ColorSensor::applyGainAndIntegration() {
  const AgcStep& step = kAgcSteps[agcIndex_];
  tcs_.setGain(step.gain);
  tcs_.setIntegrationTime(step.integration);
  gain_ = step.gainx;
  integrationRegister_ = static_cast<uint8_t>(step.integration);
  integrationMs_ = integrationMillis(integrationRegister_);
}

void ColorSensor::readRaw() {
  tcs_.getRawData(&raw_[0], &raw_[1], &raw_[2], &raw_[3]);
}

void ColorSensor::autoAdjust() {
  for (uint8_t iteration = 0; iteration < kMaxAgcIterations; ++iteration) {
    const AgcStep& step = kAgcSteps[agcIndex_];
    const uint16_t clear = raw_[3];

    if (step.maxCount != 0 && clear > step.maxCount && agcIndex_ + 1 < kAgcStepCount) {
      ++agcIndex_;  // claro demais: perde sensibilidade
    } else if (step.minCount != 0 && clear < step.minCount && agcIndex_ > 0) {
      --agcIndex_;  // escuro demais: ganha sensibilidade
    } else {
      return;  // ja esta na janela util (ou nao ha degrau para onde ir)
    }

    applyGainAndIntegration();
    // Descarta a integracao que ja estava em andamento com o ganho antigo.
    delay(2 * integrationMs_ + 2);
    readRaw();
  }
}

SensorSample ColorSensor::read() {
  SensorSample sample;
  if (!available_) {
    return sample;
  }

  readRaw();
  autoAdjust();

  sample.r = raw_[0];
  sample.g = raw_[1];
  sample.b = raw_[2];
  sample.c = raw_[3];
  sample.gain = gain_;
  sample.integrationMs = integrationMs_;
  sample.saturation = saturationFor(integrationRegister_);

  // O TCS34725 nao tem filtro de IR, entao a luz infravermelha aparece nos
  // quatro canais. A estimativa classica do DN40 e (R+G+B-C)/2.
  const int32_t sum = static_cast<int32_t>(sample.r) + sample.g + sample.b;
  const int32_t irEstimate = (sum > static_cast<int32_t>(sample.c))
                                 ? (sum - static_cast<int32_t>(sample.c)) / 2
                                 : 0;
  sample.ir = static_cast<uint16_t>(irEstimate);
  sample.rComp = subtractClamped(sample.r, sample.ir);
  sample.gComp = subtractClamped(sample.g, sample.ir);
  sample.bComp = subtractClamped(sample.b, sample.ir);
  sample.cComp = subtractClamped(sample.c, sample.ir);

  const uint16_t saturation75 =
      (sample.integrationMs < 150) ? static_cast<uint16_t>(sample.saturation - sample.saturation / 4)
                                   : sample.saturation;
  sample.saturated = (sample.integrationMs < 150) && (sample.c > saturation75);

  // Normaliza para "contagens por ms por unidade de ganho". Assim o resultado
  // nao muda quando o AGC troca de degrau no meio de uma medicao.
  const float exposure = static_cast<float>(sample.integrationMs) * static_cast<float>(sample.gain);
  if (exposure > 0.0f && whiteBalance_.isValid()) {
    sample.rLinear = (sample.rComp / exposure) / whiteBalance_.r;
    sample.gLinear = (sample.gComp / exposure) / whiteBalance_.g;
    sample.bLinear = (sample.bComp / exposure) / whiteBalance_.b;
  }

  const float countsPerLux = (sample.integrationMs * sample.gain) / (kGlassAttenuation * kDeviceFactor);
  if (countsPerLux > 0.0f) {
    sample.lux = (kLuxCoefR * sample.rComp + kLuxCoefG * sample.gComp + kLuxCoefB * sample.bComp) /
                 countsPerLux;
  }
  if (sample.rComp > 0) {
    sample.colorTemperature = kCtCoef * static_cast<float>(sample.bComp) / static_cast<float>(sample.rComp) + kCtOffset;
  }

  return sample;
}

void ColorSensor::setWhiteBalance(const WhiteBalance& balance) {
  if (balance.isValid()) {
    whiteBalance_ = balance;
  }
}

bool ColorSensor::calibrateWhiteFrom(const SensorSample& sample) {
  const float exposure = static_cast<float>(sample.integrationMs) * static_cast<float>(sample.gain);
  if (exposure <= 0.0f || sample.rComp == 0 || sample.gComp == 0 || sample.bComp == 0) {
    return false;
  }

  WhiteBalance balance;
  balance.r = sample.rComp / exposure;
  balance.g = sample.gComp / exposure;
  balance.b = sample.bComp / exposure;
  if (!balance.isValid()) {
    return false;
  }
  whiteBalance_ = balance;
  return true;
}

void ColorSensor::resetWhiteBalance() {
  whiteBalance_.r = config::kDefaultWhiteR;
  whiteBalance_.g = config::kDefaultWhiteG;
  whiteBalance_.b = config::kDefaultWhiteB;
}

}  // namespace kroma
