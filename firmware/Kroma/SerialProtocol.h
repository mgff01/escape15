// =============================================================================
// Kroma - protocolo serial.
//
// Uma linha JSON por evento (JSON Lines). O formato antigo enviava apenas o
// nome da cor, o que impedia o receptor de distinguir um dado de um log e de
// aproveitar hex/RGB. Ver docs/PROTOCOL.md.
// =============================================================================
#ifndef KROMA_SERIAL_PROTOCOL_H
#define KROMA_SERIAL_PROTOCOL_H

#include <Print.h>

#include "ColorClassifier.h"
#include "ColorSensor.h"

namespace kroma {

class SerialProtocol {
 public:
  explicit SerialProtocol(Print& out) : out_(out) {}

  // {"t":"hello","fw":"...","proto":1}
  void emitHello(const char* firmwareVersion);
  // {"t":"color","name":"Verde","hex":"#12A34B",...}
  void emitColor(const ColorReading& reading, const SensorSample& sample);
  // {"t":"log","level":"info","msg":"..."}
  void emitLog(const char* level, const char* message);
  // {"t":"status","calibrated":true,...}
  void emitStatus(const WhiteBalance& balance, bool calibrated, bool sensorOk, bool displayOk);

 private:
  void writeEscaped(const char* text);

  Print& out_;
};

}  // namespace kroma

#endif  // KROMA_SERIAL_PROTOCOL_H
