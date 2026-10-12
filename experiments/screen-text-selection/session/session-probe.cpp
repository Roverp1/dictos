#include <leptonica/allheaders.h>
#include <tesseract/baseapi.h>
#include <tesseract/resultiterator.h>

#include <algorithm>
#include <chrono>
#include <iomanip>
#include <iostream>
#include <memory>
#include <sstream>
#include <string>
#include <vector>

namespace {
using Clock = std::chrono::steady_clock;

double ms(Clock::time_point start, Clock::time_point end) {
  return std::chrono::duration<double, std::milli>(end - start).count();
}

struct Box {
  int x, y, width, height;
};

using Image = std::unique_ptr<PIX, void (*)(PIX*)>;

void printBoxes(const std::vector<Box>& boxes) {
  std::cout << '[';
  for (size_t i = 0; i < boxes.size(); ++i) {
    if (i) std::cout << ',';
    const auto& b = boxes[i];
    std::cout << '[' << b.x << ',' << b.y << ',' << b.width << ',' << b.height << ']';
  }
  std::cout << ']';
}

std::vector<Box> boxesAt(tesseract::TessBaseAPI& api, tesseract::PageIteratorLevel level) {
  std::vector<Box> boxes;
  std::unique_ptr<tesseract::ResultIterator> it(api.GetIterator());
  if (!it) return boxes;
  do {
    int x, y, right, bottom;
    if (it->BoundingBox(level, &x, &y, &right, &bottom) && right > x && bottom > y)
      boxes.push_back({x, y, right - x, bottom - y});
  } while (it->Next(level));
  return boxes;
}

void error(const char* reason) {
  std::cout << "{\"type\":\"error\",\"reason\":\"" << reason << "\"}" << std::endl;
}

bool psmValid(int psm) { return psm == 3 || psm == 6 || psm == 11; }

}  // namespace

int main(int argc, char** argv) {
  if (argc != 3) {
    std::cerr << "Usage: session-probe IMAGE.png LANG (stdin: FULL [3|6|11], "
                 "CROP X Y WIDTH HEIGHT [3|6|11], QUIT)\n";
    return 2;
  }

  const auto loadStart = Clock::now();
  Image image(pixRead(argv[1]), [](PIX* pix) { pixDestroy(&pix); });
  const auto loadEnd = Clock::now();
  if (!image) {
    std::cerr << "Could not decode image\n";
    return 1;
  }
  const int width = pixGetWidth(image.get()), height = pixGetHeight(image.get());
  tesseract::TessBaseAPI api;
  const auto initStart = Clock::now();
  const int initResult = api.Init(nullptr, argv[2]);
  const auto initEnd = Clock::now();
  if (initResult) {
    std::cerr << "Could not initialize Tesseract\n";
    return 1;
  }
  std::cout << std::fixed << std::setprecision(3);
  std::cout << "{\"type\":\"ready\",\"width\":" << width << ",\"height\":" << height
            << ",\"decodeMs\":" << ms(loadStart, loadEnd)
            << ",\"initMs\":" << ms(initStart, initEnd) << "}" << std::endl;

  std::string line;
  while (std::getline(std::cin, line)) {
    std::istringstream input(line);
    std::string command, extra;
    input >> command;
    if (command == "QUIT" && !(input >> extra)) break;

    int psm = command == "CROP" ? 6 : 3;
    long long x = 0, y = 0, w = width, h = height;
    if (command == "CROP" && !(input >> x >> y >> w >> h)) {
      error("invalid command");
      continue;
    }
    if (input >> extra) {
      std::istringstream mode(extra);
      if (!(mode >> psm) || (mode >> extra)) {
        error("invalid command");
        continue;
      }
    }
    if ((input >> extra) || (command != "FULL" && command != "CROP") || !psmValid(psm) ||
        x < 0 || y < 0 || x >= width || y >= height || w <= 0 || h <= 0 ||
        w > width - x || h > height - y) {
      error("invalid command");
      continue;
    }

    // Keep the image origin; SetRectangle crops recognition, not the PIX itself.
    if (command == "CROP") {
      const long long left = std::max(0LL, x - 20), top = std::max(0LL, y - 20);
      const long long right = std::min(static_cast<long long>(width), x + w + 20);
      const long long bottom = std::min(static_cast<long long>(height), y + h + 20);
      x = left;
      y = top;
      w = right - left;
      h = bottom - top;
    }
    const auto setStart = Clock::now();
    api.SetPageSegMode(static_cast<tesseract::PageSegMode>(psm));
    api.SetImage(image.get());
    const auto setEnd = Clock::now();
    const auto rectStart = Clock::now();
    if (command == "CROP") api.SetRectangle(static_cast<int>(x), static_cast<int>(y),
                                              static_cast<int>(w), static_cast<int>(h));
    const auto rectEnd = Clock::now();
    const auto recognizeStart = Clock::now();
    const int result = api.Recognize(nullptr);
    const auto recognizeEnd = Clock::now();
    if (result) {
      error("recognition failed");
      continue;
    }
    const auto wordsStart = Clock::now();
    const auto words = boxesAt(api, tesseract::RIL_WORD);
    const auto wordsEnd = Clock::now();
    const auto symbols = boxesAt(api, tesseract::RIL_SYMBOL);
    const auto symbolsEnd = Clock::now();

    std::cout << "{\"type\":\"result\",\"mode\":\"" << command << "\",\"psm\":" << psm
              << ",\"region\":[" << x << ',' << y << ',' << w << ',' << h << ']'
              << ",\"setImageMs\":" << ms(setStart, setEnd)
              << ",\"setRectangleMs\":" << ms(rectStart, rectEnd)
              << ",\"recognizeMs\":" << ms(recognizeStart, recognizeEnd)
              << ",\"wordsMs\":" << ms(wordsStart, wordsEnd)
              << ",\"symbolsMs\":" << ms(wordsEnd, symbolsEnd)
              << ",\"wordCount\":" << words.size() << ",\"symbolCount\":" << symbols.size()
              << ",\"words\":";
    printBoxes(words);
    std::cout << ",\"symbols\":";
    printBoxes(symbols);
    std::cout << '}' << std::endl;
  }
  api.End();
}
