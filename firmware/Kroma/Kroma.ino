// =============================================================================
// Kroma - leitor de cores para o IBMEC Day.
//
// ESP32 + TCS34725 (sensor de cor) + SSD1306 (OLED 128x64). Le a cor de uma
// amostra, mostra no display e publica na serial em JSON Lines, que e o que o
// jogo "Enigma das Marcas" (repositorio Ibmec-Day) consome.
//
// Estrutura:
//   Config.h          pinos, cadencia e constantes ajustaveis
//   ColorSensor.*     aquisicao, AGC, compensacao de IR e balanco de branco
//   ColorClassifier.* decisao de qual cor e (C++ puro, testado em tests/)
//   Display.*         desenho no OLED
//   SerialProtocol.*  formatacao das mensagens JSON
//
// Comandos aceitos na serial (uma letra + Enter):
//   w  calibra o branco com a amostra atual e grava na NVS
//   r  descarta a calibracao e volta aos valores padrao
//   s  imprime o status atual
//   h  ajuda
// =============================================================================
#include <Preferences.h>
#include <Wire.h>

#include "ColorClassifier.h"
#include "ColorSensor.h"
#include "Config.h"
#include "Display.h"
#include "SerialProtocol.h"

namespace {

constexpr char kFirmwareVersion[] = "2.0.0";

TwoWire sensorBus(1);  // barramento I2C dedicado ao sensor de cor

kroma::ColorSensor sensor;
kroma::ColorClassifier classifier;
kroma::Display display;
kroma::SerialProtocol protocol(Serial);
Preferences preferences;

bool sensorReady = false;
bool displayReady = false;
bool calibrationLoaded = false;

// Filtro de estabilidade: so anuncia a cor depois de N leituras iguais.
kroma::ColorId publishedId = kroma::ColorId::Unknown;
kroma::ColorId candidateId = kroma::ColorId::Unknown;
uint8_t candidateCount = 0;

uint32_t lastSampleAt = 0;
uint32_t lastPublishAt = 0;
uint32_t lastSensorRetryAt = 0;

kroma::SensorSample latestSample;
kroma::ColorReading latestReading;

void setLed(bool on) {
  const bool level = kroma::config::kLedActiveHigh ? on : !on;
  digitalWrite(kroma::config::kLedPin, level ? HIGH : LOW);
}

void loadCalibration() {
  preferences.begin(kroma::config::kPreferencesNamespace, /* readOnly= */ true);
  kroma::WhiteBalance balance;
  balance.r = preferences.getFloat("wb_r", 0.0f);
  balance.g = preferences.getFloat("wb_g", 0.0f);
  balance.b = preferences.getFloat("wb_b", 0.0f);
  preferences.end();

  if (balance.isValid()) {
    sensor.setWhiteBalance(balance);
    calibrationLoaded = true;
  }
}

void storeCalibration(const kroma::WhiteBalance& balance) {
  preferences.begin(kroma::config::kPreferencesNamespace, /* readOnly= */ false);
  preferences.putFloat("wb_r", balance.r);
  preferences.putFloat("wb_g", balance.g);
  preferences.putFloat("wb_b", balance.b);
  preferences.end();
}

void clearCalibration() {
  preferences.begin(kroma::config::kPreferencesNamespace, /* readOnly= */ false);
  preferences.clear();
  preferences.end();
}

bool startSensor() {
  sensorReady = sensor.begin(&sensorBus);
  if (sensorReady) {
    loadCalibration();
    protocol.emitLog("info", "Sensor TCS34725 conectado");
  }
  return sensorReady;
}

void handleCalibrate() {
  if (!sensorReady) {
    protocol.emitLog("error", "Sem sensor: calibracao ignorada");
    return;
  }
  // Uma leitura fresca garante que o AGC ja se acomodou no branco apontado.
  const kroma::SensorSample sample = sensor.read();
  if (!sensor.calibrateWhiteFrom(sample)) {
    protocol.emitLog("error", "Amostra escura demais para calibrar");
    display.showMessage("Calibracao falhou", "Aponte para o branco");
    return;
  }
  storeCalibration(sensor.whiteBalance());
  calibrationLoaded = true;
  // Forca o proximo ciclo a reavaliar e reanunciar a cor.
  publishedId = kroma::ColorId::Unknown;
  candidateCount = 0;
  protocol.emitLog("info", "Branco calibrado e salvo");
  protocol.emitStatus(sensor.whiteBalance(), calibrationLoaded, sensorReady, displayReady);
  display.showMessage("Branco calibrado", "Pronto para ler");
}

void handleReset() {
  sensor.resetWhiteBalance();
  clearCalibration();
  calibrationLoaded = false;
  publishedId = kroma::ColorId::Unknown;
  candidateCount = 0;
  protocol.emitLog("info", "Calibracao apagada");
  protocol.emitStatus(sensor.whiteBalance(), calibrationLoaded, sensorReady, displayReady);
}

void handleSerialCommands() {
  while (Serial.available() > 0) {
    const int c = Serial.read();
    switch (c) {
      case 'w':
      case 'W':
        handleCalibrate();
        break;
      case 'r':
      case 'R':
        handleReset();
        break;
      case 's':
      case 'S':
        protocol.emitStatus(sensor.whiteBalance(), calibrationLoaded, sensorReady, displayReady);
        break;
      case 'h':
      case 'H':
        protocol.emitLog("info", "w=calibrar branco | r=resetar | s=status | h=ajuda");
        break;
      default:
        break;  // ignora \r, \n e digitacao acidental
    }
  }
}

// Aplica o filtro de estabilidade. Retorna true quando o estado publicado muda.
bool updateStability(kroma::ColorId id) {
  if (id != candidateId) {
    candidateId = id;
    candidateCount = 1;
    return false;
  }
  if (candidateCount < kroma::config::kStableSamplesRequired) {
    ++candidateCount;
  }
  if (candidateCount < kroma::config::kStableSamplesRequired || id == publishedId) {
    return false;
  }
  publishedId = id;
  return true;
}

}  // namespace

void setup() {
  Serial.begin(kroma::config::kSerialBaud);

  pinMode(kroma::config::kLedPin, OUTPUT);
  setLed(true);

  Wire.begin(kroma::config::kOledSdaPin, kroma::config::kOledSclPin,
             kroma::config::kOledFrequency);
  sensorBus.begin(kroma::config::kSensorSdaPin, kroma::config::kSensorSclPin,
                  kroma::config::kSensorFrequency);

  displayReady = display.begin();
  if (displayReady) {
    display.showSplash();
  }

  protocol.emitHello(kFirmwareVersion);
  if (!displayReady) {
    protocol.emitLog("warn", "Display OLED nao respondeu");
  }

  if (!startSensor()) {
    // Antes o firmware travava em um while(1) aqui. Agora ele segue vivo e
    // tenta de novo: religar o sensor no meio da feira nao exige reset.
    protocol.emitLog("error", "Sensor TCS34725 nao encontrado; tentando de novo");
    display.showError("Sensor ausente", "Confira o I2C");
  }

  delay(kroma::config::kLedWarmupMs);
  lastSampleAt = millis();
}

void loop() {
  handleSerialCommands();

  const uint32_t now = millis();

  if (!sensorReady) {
    if (now - lastSensorRetryAt >= 2000) {
      lastSensorRetryAt = now;
      if (startSensor()) {
        display.showMessage("Sensor conectado", "Iniciando leitura");
      }
    }
    return;
  }

  // Subtracao sem sinal com millis() e segura tambem no estouro de 49 dias.
  if (now - lastSampleAt < kroma::config::kSampleIntervalMs) {
    return;
  }
  lastSampleAt = now;

  latestSample = sensor.read();
  latestReading = classifier.classify(latestSample.rLinear, latestSample.gLinear,
                                      latestSample.bLinear);

  display.showReading(latestReading, latestSample, calibrationLoaded);

  const bool changed = updateStability(latestReading.id);
  const bool heartbeat = (now - lastPublishAt) >= kroma::config::kHeartbeatMs;
  if (changed || (heartbeat && publishedId != kroma::ColorId::Unknown)) {
    protocol.emitColor(latestReading, latestSample);
    lastPublishAt = now;
  }
}
