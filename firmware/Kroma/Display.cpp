#include "Display.h"

#include <stdio.h>

namespace kroma {

bool Display::begin() {
  available_ = u8g2_.begin();
  return available_;
}

void Display::showSplash() {
  if (!available_) return;
  u8g2_.clearBuffer();
  u8g2_.setFont(u8g2_font_logisoso18_tr);
  u8g2_.drawStr(26, 30, "KROMA");
  u8g2_.setFont(u8g2_font_t0_11b_tf);
  u8g2_.drawStr(14, 50, "Leitor de cores");
  u8g2_.sendBuffer();
}

void Display::showMessage(const char* title, const char* subtitle) {
  if (!available_) return;
  u8g2_.clearBuffer();
  u8g2_.setFont(u8g2_font_t0_11b_tf);
  u8g2_.drawStr(0, 26, title);
  if (subtitle != nullptr) {
    u8g2_.setFont(u8g2_font_t0_11_tf);
    u8g2_.drawStr(0, 44, subtitle);
  }
  u8g2_.sendBuffer();
}

void Display::showError(const char* title, const char* detail) {
  if (!available_) return;
  u8g2_.clearBuffer();
  u8g2_.setFont(u8g2_font_t0_11b_tf);
  u8g2_.drawStr(0, 20, "ERRO");
  u8g2_.drawStr(0, 38, title);
  if (detail != nullptr) {
    u8g2_.setFont(u8g2_font_t0_11_tf);
    u8g2_.drawStr(0, 56, detail);
  }
  u8g2_.sendBuffer();
}

void Display::showReading(const ColorReading& reading, const SensorSample& sample, bool calibrated) {
  if (!available_) return;

  char line[26];

  u8g2_.clearBuffer();

  // Nome da cor em destaque.
  u8g2_.setFont(u8g2_font_logisoso18_tr);
  u8g2_.setCursor(0, 22);
  u8g2_.print(reading.name);
  u8g2_.drawHLine(0, 28, 128);

  // Hexadecimal.
  u8g2_.setFont(u8g2_font_t0_11b_tf);
  snprintf(line, sizeof(line), "Hex: #%02X%02X%02X", reading.r8, reading.g8, reading.b8);
  u8g2_.drawStr(0, 42, line);

  // RGB de 8 bits.
  snprintf(line, sizeof(line), "RGB: %u,%u,%u", reading.r8, reading.g8, reading.b8);
  u8g2_.drawStr(0, 54, line);

  // Rodape com avisos: saturacao e calibracao pendente sao as duas causas mais
  // comuns de leitura estranha, entao ficam visiveis sem abrir o serial.
  u8g2_.setFont(u8g2_font_4x6_tr);
  if (sample.saturated) {
    u8g2_.drawStr(0, 63, "SATURADO - afaste a amostra");
  } else if (!calibrated) {
    u8g2_.drawStr(0, 63, "sem calibracao - envie 'w'");
  } else {
    snprintf(line, sizeof(line), "gain %ux  %ums  %.0f lux", sample.gain, sample.integrationMs,
             sample.lux < 0.0f ? 0.0f : sample.lux);
    u8g2_.drawStr(0, 63, line);
  }

  u8g2_.sendBuffer();
}

}  // namespace kroma
