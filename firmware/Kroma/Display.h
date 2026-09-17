// =============================================================================
// Kroma - tudo que vai para o OLED 128x64.
//
// Concentrar o desenho aqui mantem o loop principal legivel e deixa a troca de
// display (ou a remocao dele) restrita a um unico arquivo.
// =============================================================================
#ifndef KROMA_DISPLAY_H
#define KROMA_DISPLAY_H

#include <U8g2lib.h>

#include "ColorClassifier.h"
#include "ColorSensor.h"

namespace kroma {

class Display {
 public:
  bool begin();

  void showSplash();
  void showMessage(const char* title, const char* subtitle);
  void showError(const char* title, const char* detail);
  void showReading(const ColorReading& reading, const SensorSample& sample, bool calibrated);

  bool isAvailable() const { return available_; }

 private:
  U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2_{U8G2_R0, /* reset= */ U8X8_PIN_NONE};
  bool available_ = false;
};

}  // namespace kroma

#endif  // KROMA_DISPLAY_H
