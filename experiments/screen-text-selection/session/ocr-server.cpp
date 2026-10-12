#include <leptonica/allheaders.h>
#include <tesseract/baseapi.h>
#include <tesseract/resultiterator.h>

#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>

#include <algorithm>
#include <chrono>
#include <cerrno>
#include <cstring>
#include <iomanip>
#include <iostream>
#include <memory>
#include <sstream>
#include <string>

namespace {
using Clock = std::chrono::steady_clock;
using Image = std::unique_ptr<PIX, void (*)(PIX*)>;

void jsonString(std::ostream& out, const std::string& text) {
  constexpr char hex[] = "0123456789abcdef";
  out << '"';
  for (size_t i = 0; i < text.size();) {
    const auto c = static_cast<unsigned char>(text[i]);
    if (c == '"' || c == '\\') {
      out << '\\' << static_cast<char>(c);
      ++i;
    } else if (c < 0x20) {
      out << "\\u00" << hex[c >> 4] << hex[c & 15];
      ++i;
    } else if (c < 0x80) {
      out << static_cast<char>(c);
      ++i;
    } else {
      const size_t count = c >= 0xc2 && c <= 0xdf ? 2 : c >= 0xe0 && c <= 0xef ? 3 :
                           c >= 0xf0 && c <= 0xf4 ? 4 : 0;
      bool valid = count && i + count <= text.size();
      if (valid) {
        for (size_t j = 1; j < count; ++j) {
          const auto next = static_cast<unsigned char>(text[i + j]);
          if (next < 0x80 || next > 0xbf) valid = false;
        }
        const auto second = static_cast<unsigned char>(text[i + 1]);
        if ((c == 0xe0 && second < 0xa0) || (c == 0xed && second > 0x9f) ||
            (c == 0xf0 && second < 0x90) || (c == 0xf4 && second > 0x8f)) valid = false;
      }
      if (valid) {
        out.write(text.data() + i, count);
        i += count;
      } else {
        out << "\\ufffd";
        ++i;
      }
    }
  }
  out << '"';
}

std::string textAt(tesseract::ResultIterator& it, tesseract::PageIteratorLevel level) {
  std::unique_ptr<char[]> text(it.GetUTF8Text(level));
  return text ? text.get() : "";
}

std::string trim(const std::string& text) {
  const auto start = text.find_first_not_of(" \t\r\n\f\v");
  if (start == std::string::npos) return "";
  return text.substr(start, text.find_last_not_of(" \t\r\n\f\v") - start + 1);
}

bool boxAt(tesseract::ResultIterator& it, tesseract::PageIteratorLevel level,
           int& x, int& y, int& w, int& h) {
  int right, bottom;
  if (!it.BoundingBox(level, &x, &y, &right, &bottom)) return false;
  w = right - x;
  h = bottom - y;
  return w > 0 && h > 0;
}

void box(std::ostream& out, int x, int y, int w, int h) {
  out << "\"x\":" << x << ",\"y\":" << y << ",\"width\":" << w
      << ",\"height\":" << h;
}

std::string recognize(tesseract::TessBaseAPI& api, PIX* image, const std::string& request) {
  std::istringstream input(request);
  std::string command, extra;
  int psm = 0;
  long long x = 0, y = 0, w = pixGetWidth(image), h = pixGetHeight(image);
  if (!(input >> command) || (command != "FULL" && command != "CROP"))
    return "{\"error\":\"Invalid OCR request.\"}\n";
  if (command == "CROP" && !(input >> x >> y >> w >> h))
    return "{\"error\":\"Invalid OCR region.\"}\n";
  if (!(input >> psm) || (input >> extra) || (psm != 3 && psm != 6 && psm != 11) ||
      x < 0 || y < 0 || x >= pixGetWidth(image) || y >= pixGetHeight(image) ||
      w <= 0 || h <= 0 || w > pixGetWidth(image) - x || h > pixGetHeight(image) - y)
    return "{\"error\":\"Invalid OCR request or region.\"}\n";

  const auto started = Clock::now();
  if (command == "CROP") {
    const auto left = std::max(0LL, x - 20), top = std::max(0LL, y - 20);
    const auto right = std::min(static_cast<long long>(pixGetWidth(image)), x + w + 20);
    const auto bottom = std::min(static_cast<long long>(pixGetHeight(image)), y + h + 20);
    x = left; y = top; w = right - left; h = bottom - top;
  }
  api.SetPageSegMode(static_cast<tesseract::PageSegMode>(psm));
  // SetImage clears any previous rectangle, including after a crop.
  api.SetImage(image);
  if (command == "CROP") api.SetRectangle(x, y, w, h);
  if (api.Recognize(nullptr)) return "{\"error\":\"OCR recognition failed.\"}\n";

  std::ostringstream words;
  words << '[';
  size_t wordCount = 0, symbolCount = 0;
  int block = 0, paragraph = 0, line = 0;
  bool currentWord = false;
  size_t symbolsInWord = 0;
  std::unique_ptr<tesseract::ResultIterator> it(api.GetIterator());
  if (it) {
    do {
      if (it->IsAtBeginningOf(tesseract::RIL_BLOCK)) { ++block; paragraph = 0; line = 0; }
      if (it->IsAtBeginningOf(tesseract::RIL_PARA)) { ++paragraph; line = 0; }
      if (it->IsAtBeginningOf(tesseract::RIL_TEXTLINE)) ++line;
      if (it->IsAtBeginningOf(tesseract::RIL_WORD)) {
        if (currentWord) words << "]}";
        symbolsInWord = 0;
        int bx, by, bw, bh;
        const auto text = trim(textAt(*it, tesseract::RIL_WORD));
        currentWord = !text.empty() && boxAt(*it, tesseract::RIL_WORD, bx, by, bw, bh);
        if (currentWord) {
          if (wordCount++) words << ',';
          words << "{\"text\":";
          jsonString(words, text);
          words << ',';
          box(words, bx, by, bw, bh);
          words << ",\"block\":" << block << ",\"line\":";
          jsonString(words, std::to_string(block) + ":" + std::to_string(paragraph) + ":" + std::to_string(line));
          words << ",\"confidence\":" << it->Confidence(tesseract::RIL_WORD)
                << ",\"symbols\":[";
        }
      }
      int sx, sy, sw, sh;
      if (currentWord && boxAt(*it, tesseract::RIL_SYMBOL, sx, sy, sw, sh)) {
        const auto text = textAt(*it, tesseract::RIL_SYMBOL);
        if (!text.empty()) {
          if (symbolsInWord++) words << ',';
          words << "{\"text\":";
          jsonString(words, text);
          words << ',';
          box(words, sx, sy, sw, sh);
          words << ",\"confidence\":" << it->Confidence(tesseract::RIL_SYMBOL) << '}';
          ++symbolCount;
        }
      }
      if (!it->Next(tesseract::RIL_SYMBOL)) break;
    } while (true);
    if (currentWord) words << "]}";
  }
  words << ']';
  const auto elapsed = std::chrono::duration<double, std::milli>(Clock::now() - started).count();
  std::ostringstream output;
  output << std::fixed << std::setprecision(3) << "{\"elapsedMs\":" << elapsed
         << ",\"width\":" << pixGetWidth(image) << ",\"height\":" << pixGetHeight(image)
         << ",\"symbolCount\":" << symbolCount << ",\"coordinateSpace\":\"screenshot\"";
  if (command == "CROP") {
    output << ",\"region\":{";
    box(output, x, y, w, h);
    output << '}';
  }
  output << ",\"words\":" << words.str() << "}\n";
  return output.str();
}

bool sendAll(int fd, const std::string& message) {
  size_t offset = 0;
  while (offset < message.size()) {
    const auto count = send(fd, message.data() + offset, message.size() - offset, MSG_NOSIGNAL);
    if (count <= 0) return false;
    offset += count;
  }
  return true;
}
}  // namespace

int main(int argc, char** argv) {
  if (argc != 4) {
    std::cerr << "Usage: ocr-server SOCKET IMAGE LANG\n";
    return 2;
  }
  tesseract::TessBaseAPI api;
  const auto initStart = Clock::now();
  if (api.Init(nullptr, argv[3])) {
    std::cerr << "Could not initialize Tesseract\n";
    return 1;
  }
  const auto initMs = std::chrono::duration<double, std::milli>(Clock::now() - initStart).count();
  if (std::strlen(argv[1]) >= sizeof(sockaddr_un::sun_path)) {
    std::cerr << "Socket path too long\n";
    return 1;
  }
  const int server = socket(AF_UNIX, SOCK_STREAM, 0);
  if (server < 0) return 1;
  sockaddr_un address{};
  address.sun_family = AF_UNIX;
  std::strcpy(address.sun_path, argv[1]);
  if (bind(server, reinterpret_cast<sockaddr*>(&address), sizeof(address)) || listen(server, 4)) {
    std::cerr << "Could not bind OCR socket\n";
    close(server);
    return 1;
  }
  std::cout << "{\"ready\":true,\"initMs\":" << initMs << "}" << std::endl;
  Image image(nullptr, [](PIX* pix) { pixDestroy(&pix); });
  while (true) {
    const int client = accept(server, nullptr, nullptr);
    if (client < 0) { if (errno == EINTR) continue; break; }
    std::string request;
    char c;
    while (request.size() < 128 && recv(client, &c, 1, 0) == 1 && c != '\n') request += c;
    std::string response;
    if (request.size() >= 128) response = "{\"error\":\"OCR request too long.\"}\n";
    else {
      if (!image) image.reset(pixRead(argv[2]));
      response = image ? recognize(api, image.get(), request) : "{\"error\":\"Could not decode screenshot.\"}\n";
    }
    sendAll(client, response);
    close(client);
  }
  close(server);
  unlink(argv[1]);
  api.End();
}
