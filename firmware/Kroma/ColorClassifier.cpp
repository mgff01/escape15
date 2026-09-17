#include "ColorClassifier.h"

namespace kroma {
namespace {

struct HueBand {
  float begin;  // inclusivo, em graus
  float end;    // exclusivo, em graus
  ColorId id;
};

// Faixas de matiz. A faixa do vermelho cruza 0 grau, entao aparece partida em
// duas entradas. As bordas foram escolhidas para que as sete cores usadas pelo
// jogo do IBMEC Day fiquem bem separadas sob o LED branco do modulo.
constexpr HueBand kHueBands[] = {
    {0.0f, 14.0f, ColorId::Red},       {14.0f, 44.0f, ColorId::Orange},
    {44.0f, 70.0f, ColorId::Yellow},   {70.0f, 165.0f, ColorId::Green},
    {165.0f, 200.0f, ColorId::Cyan},   {200.0f, 255.0f, ColorId::Blue},
    {255.0f, 345.0f, ColorId::Magenta}, {345.0f, 360.0f, ColorId::Red},
};

constexpr int kHueBandCount = sizeof(kHueBands) / sizeof(kHueBands[0]);

float clamp01(float value) {
  if (value < 0.0f) return 0.0f;
  if (value > 1.0f) return 1.0f;
  return value;
}

uint8_t toByte(float value) {
  return static_cast<uint8_t>(clamp01(value) * 255.0f + 0.5f);
}

ColorId bandFor(float hue) {
  for (int i = 0; i < kHueBandCount; ++i) {
    if (hue >= kHueBands[i].begin && hue < kHueBands[i].end) {
      return kHueBands[i].id;
    }
  }
  return ColorId::Unknown;
}

}  // namespace

Hsv toHsv(float r, float g, float b) {
  const float max = (r > g) ? ((r > b) ? r : b) : ((g > b) ? g : b);
  const float min = (r < g) ? ((r < b) ? r : b) : ((g < b) ? g : b);
  const float delta = max - min;

  Hsv hsv;
  hsv.v = clamp01(max);
  hsv.s = (max <= 0.0f) ? 0.0f : clamp01(delta / max);

  if (delta <= 0.0f) {
    hsv.h = 0.0f;
    return hsv;
  }

  float hue;
  if (max == r) {
    hue = 60.0f * ((g - b) / delta);
  } else if (max == g) {
    hue = 60.0f * (2.0f + (b - r) / delta);
  } else {
    hue = 60.0f * (4.0f + (r - g) / delta);
  }
  if (hue < 0.0f) hue += 360.0f;
  if (hue >= 360.0f) hue -= 360.0f;
  hsv.h = hue;
  return hsv;
}

ColorReading ColorClassifier::classify(float r, float g, float b) const {
  ColorReading reading;
  reading.hsv = toHsv(r, g, b);
  reading.r8 = toByte(r);
  reading.g8 = toByte(g);
  reading.b8 = toByte(b);

  if (reading.hsv.v < config_.blackValue) {
    reading.id = ColorId::Black;
  } else if (reading.hsv.s < config_.achromaticSaturation) {
    reading.id = (reading.hsv.v >= config_.whiteValue) ? ColorId::White : ColorId::Gray;
  } else {
    reading.id = bandFor(reading.hsv.h);
  }

  reading.name = nameOf(reading.id);
  return reading;
}

const char* ColorClassifier::nameOf(ColorId id) {
  switch (id) {
    case ColorId::Black:   return "Preto";
    case ColorId::Gray:    return "Cinza";
    case ColorId::White:   return "Branco";
    case ColorId::Red:     return "Vermelho";
    case ColorId::Orange:  return "Laranja";
    case ColorId::Yellow:  return "Amarelo";
    case ColorId::Green:   return "Verde";
    case ColorId::Cyan:    return "Ciano";
    case ColorId::Blue:    return "Azul";
    case ColorId::Magenta: return "Magenta";
    case ColorId::Unknown:
    default:               return "Nao Ident.";
  }
}

}  // namespace kroma
