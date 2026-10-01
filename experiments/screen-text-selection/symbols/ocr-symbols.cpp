#include <leptonica/allheaders.h>
#include <tesseract/baseapi.h>
#include <tesseract/resultiterator.h>

#include <algorithm>
#include <chrono>
#include <cerrno>
#include <cstdlib>
#include <iostream>
#include <memory>
#include <sstream>
#include <string>
#include <vector>

namespace {

struct Bounds {
  int x, y, width, height;
};

struct Symbol {
  std::string text;
  Bounds box;
  float confidence;
};

struct Word {
  std::string text;
  Bounds box;
  int block;
  std::string line;
  float confidence;
  std::vector<Symbol> symbols;
};

std::string textAt(tesseract::ResultIterator& it, tesseract::PageIteratorLevel level) {
  std::unique_ptr<char[]> text(it.GetUTF8Text(level));
  return text ? text.get() : "";
}

std::string trimAscii(const std::string& text) {
  const auto start = text.find_first_not_of(" \t\r\n\f\v");
  if (start == std::string::npos) return "";
  return text.substr(start, text.find_last_not_of(" \t\r\n\f\v") - start + 1);
}

bool boxAt(tesseract::ResultIterator& it, tesseract::PageIteratorLevel level, Bounds& box) {
  int right, bottom;
  if (!it.BoundingBox(level, &box.x, &box.y, &right, &bottom)) return false;
  box.width = right - box.x;
  box.height = bottom - box.y;
  return box.width > 0 && box.height > 0;
}

// Preserve valid UTF-8 sequences; replace malformed bytes so stdout stays valid JSON.
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
      const size_t count = c >= 0xc2 && c <= 0xdf ? 2 :
                           c >= 0xe0 && c <= 0xef ? 3 :
                           c >= 0xf0 && c <= 0xf4 ? 4 : 0;
      bool valid = count && i + count <= text.size();
      if (valid) {
        for (size_t j = 1; j < count; ++j) {
          const auto next = static_cast<unsigned char>(text[i + j]);
          if (next < 0x80 || next > 0xbf) valid = false;
        }
      }
      if (valid) {
        const auto second = static_cast<unsigned char>(text[i + 1]);
        if ((c == 0xe0 && second < 0xa0) || (c == 0xed && second > 0x9f) ||
            (c == 0xf0 && second < 0x90) || (c == 0xf4 && second > 0x8f))
          valid = false;
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

void jsonBox(std::ostream& out, const Bounds& box) {
  out << "\"x\":" << box.x << ",\"y\":" << box.y
      << ",\"width\":" << box.width << ",\"height\":" << box.height;
}

void jsonWords(std::ostream& out, const std::vector<Word>& words) {
  out << '[';
  for (size_t i = 0; i < words.size(); ++i) {
    if (i) out << ',';
    const auto& word = words[i];
    out << "{\"text\":";
    jsonString(out, word.text);
    out << ',';
    jsonBox(out, word.box);
    out << ",\"block\":" << word.block << ",\"line\":";
    jsonString(out, word.line);
    out << ",\"confidence\":" << word.confidence << ",\"symbols\":[";
    for (size_t j = 0; j < word.symbols.size(); ++j) {
      if (j) out << ',';
      const auto& symbol = word.symbols[j];
      out << "{\"text\":";
      jsonString(out, symbol.text);
      out << ',';
      jsonBox(out, symbol.box);
      out << ",\"confidence\":" << symbol.confidence << '}';
    }
    out << "]}";
  }
  out << ']';
}

}  // namespace

int main(int argc, char** argv) {
  if (argc != 4 && argc != 8) {
    std::cerr << "Usage: ocr-symbols IMAGE.png LANG PSM [X Y WIDTH HEIGHT]\n";
    return 2;
  }
  char* end = nullptr;
  const long psm = std::strtol(argv[3], &end, 10);
  if (*end || (psm != 3 && psm != 6 && psm != 11)) {
    std::cerr << "PSM must be 3, 6, or 11\n";
    return 2;
  }

  const auto started = std::chrono::steady_clock::now();
  std::unique_ptr<PIX, void (*)(PIX*)> image(pixRead(argv[1]), [](PIX* pix) { pixDestroy(&pix); });
  if (!image) {
    std::cerr << "Could not read image: " << argv[1] << '\n';
    return 1;
  }
  const int imageWidth = pixGetWidth(image.get());
  const int imageHeight = pixGetHeight(image.get());
  Bounds region{};
  if (argc == 8) {
    long long values[4]{};
    for (int i = 0; i < 4; ++i) {
      char* rest = nullptr;
      errno = 0;
      values[i] = std::strtoll(argv[i + 4], &rest, 10);
      if (errno || rest == argv[i + 4] || *rest) {
        std::cerr << "Invalid OCR region\n";
        return 2;
      }
    }
    const long long x = values[0], y = values[1], width = values[2], height = values[3];
    if (x < 0 || y < 0 || x >= imageWidth || y >= imageHeight || width <= 0 || height <= 0 ||
        width > imageWidth - x || height > imageHeight - y) {
      std::cerr << "OCR region is outside the screenshot\n";
      return 2;
    }
    constexpr long long margin = 20;
    const long long left = std::max(0LL, x - margin);
    const long long top = std::max(0LL, y - margin);
    const long long right = std::min(static_cast<long long>(imageWidth), x + width + margin);
    const long long bottom = std::min(static_cast<long long>(imageHeight), y + height + margin);
    region = {static_cast<int>(left), static_cast<int>(top), static_cast<int>(right - left),
              static_cast<int>(bottom - top)};
  }
  tesseract::TessBaseAPI api;
  if (api.Init(nullptr, argv[2])) {
    std::cerr << "Could not initialize Tesseract for language: " << argv[2] << '\n';
    return 1;
  }
  api.SetPageSegMode(static_cast<tesseract::PageSegMode>(psm));
  api.SetImage(image.get());
  if (argc == 8)
    api.SetRectangle(region.x, region.y, region.width, region.height);
  if (api.Recognize(nullptr)) {
    std::cerr << "Tesseract recognition failed\n";
    return 1;
  }

  std::vector<Word> words;
  size_t symbolCount = 0;
  int block = 0, paragraph = 0, line = 0;
  bool currentWordValid = false;
  std::unique_ptr<tesseract::ResultIterator> it(api.GetIterator());
  if (it) {
    do {
      if (it->IsAtBeginningOf(tesseract::RIL_BLOCK)) {
        ++block;
        paragraph = 0;
        line = 0;
      }
      if (it->IsAtBeginningOf(tesseract::RIL_PARA)) {
        ++paragraph;
        line = 0;
      }
      if (it->IsAtBeginningOf(tesseract::RIL_TEXTLINE)) ++line;
      if (it->IsAtBeginningOf(tesseract::RIL_WORD)) {
        Bounds box{};
        const auto text = trimAscii(textAt(*it, tesseract::RIL_WORD));
        currentWordValid = !text.empty() && boxAt(*it, tesseract::RIL_WORD, box);
        if (currentWordValid) {
          words.push_back({text, box, block,
                           std::to_string(block) + ":" + std::to_string(paragraph) + ":" + std::to_string(line),
                           it->Confidence(tesseract::RIL_WORD), {}});
        }
      }
      Bounds box{};
      if (currentWordValid && boxAt(*it, tesseract::RIL_SYMBOL, box)) {
        const auto text = textAt(*it, tesseract::RIL_SYMBOL);
        if (!text.empty()) {
          words.back().symbols.push_back({text, box, it->Confidence(tesseract::RIL_SYMBOL)});
          ++symbolCount;
        }
      }
    } while (it->Next(tesseract::RIL_SYMBOL));
  }
  const auto elapsed = std::chrono::duration<double, std::milli>(
      std::chrono::steady_clock::now() - started).count();
  std::ostringstream output;
  output << "{\"elapsedMs\":" << elapsed << ",\"width\":" << imageWidth
         << ",\"height\":" << imageHeight << ",\"symbolCount\":" << symbolCount;
  if (argc == 8)
    output << ",\"coordinateSpace\":\"screenshot\",\"region\":{"
           << "\"x\":" << region.x << ",\"y\":" << region.y
           << ",\"width\":" << region.width << ",\"height\":" << region.height << '}';
  output
         << ",\"words\":";
  jsonWords(output, words);
  output << "}\n";
  std::cout << output.str();
}
