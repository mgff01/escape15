// =============================================================================
// Kroma - classificacao de cor.
//
// Deliberadamente livre de qualquer dependencia de Arduino: e C++ puro, o que
// permite compilar e testar essa logica no PC (ver tests/). O firmware apenas
// alimenta o classificador com valores ja balanceados pelo branco.
// =============================================================================
#ifndef KROMA_COLOR_CLASSIFIER_H
#define KROMA_COLOR_CLASSIFIER_H

#include <stdint.h>

namespace kroma {

enum class ColorId : uint8_t {
  Unknown = 0,
  Black,
  Gray,
  White,
  Red,
  Orange,
  Yellow,
  Green,
  Cyan,
  Blue,
  Magenta,
};

struct Hsv {
  float h;  // matiz em graus, [0, 360)
  float s;  // saturacao, [0, 1]
  float v;  // valor/brilho relativo ao branco calibrado, [0, 1]
};

struct ColorReading {
  ColorId id;
  const char* name;  // pt-BR sem acentos: as fontes do OLED sao ASCII
  Hsv hsv;
  uint8_t r8;
  uint8_t g8;
  uint8_t b8;
};

// Limiares que separam acromatico (preto/cinza/branco) de cromatico. Sao
// campos e nao constantes para que os testes possam varia-los.
struct ClassifierConfig {
  // Abaixo deste brilho nada e distinguivel: e preto.
  float blackValue = 0.07f;
  // Abaixo desta saturacao a amostra nao tem matiz util.
  float achromaticSaturation = 0.18f;
  // Acromatico acima deste brilho e branco; abaixo, cinza.
  float whiteValue = 0.55f;
};

// Converte um par (canal linear, referencia de branco) em HSV.
Hsv toHsv(float r, float g, float b);

class ColorClassifier {
 public:
  ColorClassifier() = default;
  explicit ColorClassifier(const ClassifierConfig& config) : config_(config) {}

  // r, g, b sao valores lineares ja balanceados pelo branco, onde 1.0
  // corresponde a referencia branca. Valores acima de 1.0 sao saturados.
  ColorReading classify(float r, float g, float b) const;

  const ClassifierConfig& config() const { return config_; }
  void setConfig(const ClassifierConfig& config) { config_ = config; }

  // Nome legivel de um identificador, util para logs e testes.
  static const char* nameOf(ColorId id);

 private:
  ClassifierConfig config_;
};

}  // namespace kroma

#endif  // KROMA_COLOR_CLASSIFIER_H
