#include "SerialProtocol.h"

#include <stdio.h>

namespace kroma {

void SerialProtocol::writeEscaped(const char* text) {
  if (text == nullptr) return;
  for (const char* p = text; *p != '\0'; ++p) {
    const char c = *p;
    if (c == '"' || c == '\\') {
      out_.write('\\');
      out_.write(c);
    } else if (c >= 0 && c < 0x20) {
      // Caracteres de controle nao podem aparecer crus dentro de uma string.
      char escape[7];
      snprintf(escape, sizeof(escape), "\\u%04X", static_cast<unsigned>(c));
      out_.print(escape);
    } else {
      out_.write(c);
    }
  }
}

void SerialProtocol::emitHello(const char* firmwareVersion) {
  out_.print("{\"t\":\"hello\",\"fw\":\"");
  writeEscaped(firmwareVersion);
  out_.print("\",\"proto\":1}\n");
}

void SerialProtocol::emitColor(const ColorReading& reading, const SensorSample& sample) {
  char buffer[192];
  snprintf(buffer, sizeof(buffer),
           "{\"t\":\"color\",\"name\":\"%s\",\"hex\":\"#%02X%02X%02X\","
           "\"rgb\":[%u,%u,%u],\"hsv\":[%.1f,%.3f,%.3f],"
           "\"lux\":%.1f,\"ct\":%.0f,\"gain\":%u,\"sat\":%s}\n",
           reading.name, reading.r8, reading.g8, reading.b8, reading.r8, reading.g8, reading.b8,
           reading.hsv.h, reading.hsv.s, reading.hsv.v, sample.lux < 0.0f ? 0.0f : sample.lux,
           sample.colorTemperature, sample.gain, sample.saturated ? "true" : "false");
  out_.print(buffer);
}

void SerialProtocol::emitLog(const char* level, const char* message) {
  out_.print("{\"t\":\"log\",\"level\":\"");
  writeEscaped(level);
  out_.print("\",\"msg\":\"");
  writeEscaped(message);
  out_.print("\"}\n");
}

void SerialProtocol::emitStatus(const WhiteBalance& balance, bool calibrated, bool sensorOk,
                                bool displayOk) {
  char buffer[160];
  snprintf(buffer, sizeof(buffer),
           "{\"t\":\"status\",\"sensor\":%s,\"display\":%s,\"calibrated\":%s,"
           "\"white\":[%.3f,%.3f,%.3f]}\n",
           sensorOk ? "true" : "false", displayOk ? "true" : "false",
           calibrated ? "true" : "false", balance.r, balance.g, balance.b);
  out_.print(buffer);
}

}  // namespace kroma
