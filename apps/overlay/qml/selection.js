function distanceToBox(word, x, y) {
  return Math.hypot(
    Math.max(word.x - x, 0, x - word.x - word.width),
    Math.max(word.y - y, 0, y - word.y - word.height)
  );
}
function hit(words, x, y) {
  var nearest = -1,
    distance = Infinity;
  for (var index = 0; index < words.length; index++) {
    var current = distanceToBox(words[index], x, y);
    if (
      current < distance &&
      current <= Math.max(20, words[index].height * 1.5)
    ) {
      nearest = index;
      distance = current;
    }
  }
  return nearest;
}
function usableSymbols(word) {
  var symbols = word.symbols;
  if (
    !Array.isArray(symbols) ||
    !symbols.length ||
    symbols
      .map(function (s) {
        return s.text;
      })
      .join("") !== word.text
  )
    return null;
  for (var i = 0; i < symbols.length; i++) {
    var s = symbols[i];
    if (
      !s.text ||
      ![s.x, s.y, s.width, s.height].every(Number.isFinite) ||
      s.width <= 0 ||
      s.height <= 0 ||
      s.x < word.x - 2 ||
      s.x + s.width > word.x + word.width + 2 ||
      s.y < word.y - 2 ||
      s.y + s.height > word.y + word.height + 2 ||
      (i && s.x < symbols[i - 1].x)
    )
      return null;
  }
  return symbols;
}
function boundary(words, wordIndex, x, side, nearest) {
  var word = words[wordIndex],
    symbols = usableSymbols(word);
  if (!symbols) return { word: wordIndex, offset: side === "start" ? 0 : 1 };
  var selected = 0,
    distance = Infinity;
  for (var i = 0; i < symbols.length + (nearest ? 1 : 0); i++) {
    var current = nearest
      ? Math.abs(
          x -
            (i === symbols.length
              ? symbols[i - 1].x + symbols[i - 1].width
              : symbols[i].x)
        )
      : distanceToBox(symbols[i], x, symbols[i].y + symbols[i].height / 2);
    if (current < distance) {
      selected = i;
      distance = current;
    }
  }
  return {
    word: wordIndex,
    offset: selected + (!nearest && side === "end" ? 1 : 0),
  };
}
function normalized(words, a, b) {
  var forward = a.word < b.word || (a.word === b.word && a.offset <= b.offset);
  var first = forward ? a : b,
    last = forward ? b : a;
  return {
    start: usableSymbols(words[first.word])
      ? first
      : { word: first.word, offset: 0 },
    end: usableSymbols(words[last.word])
      ? last
      : { word: last.word, offset: 1 },
  };
}
function rangeAt(words, anchor, focus, precise) {
  var start = hit(words, anchor.x, anchor.y),
    end = hit(words, focus.x, focus.y);
  if (start < 0 || end < 0) return null;
  if (!precise)
    return {
      start: { word: Math.min(start, end), offset: 0 },
      end: {
        word: Math.max(start, end),
        offset: usableSymbols(words[Math.max(start, end)])?.length ?? 1,
      },
      whole: true,
    };
  var forward = start < end || (start === end && anchor.x <= focus.x);
  return normalized(
    words,
    boundary(words, start, anchor.x, forward ? "start" : "end", false),
    boundary(words, end, focus.x, forward ? "end" : "start", false)
  );
}
function moveHandle(words, range, side, x, y) {
  var index = hit(words, x, y);
  if (!range || index < 0) return range;
  var moved = boundary(words, index, x, side, true);
  return side === "start"
    ? normalized(words, moved, range.end)
    : normalized(words, range.start, moved);
}
function pieces(words, range) {
  if (!range) return [];
  var result = [];
  for (var index = range.start.word; index <= range.end.word; index++) {
    var word = words[index],
      symbols = usableSymbols(word);
    if (!symbols || range.whole) {
      result.push({ text: word.text, boxes: [word] });
      continue;
    }
    var from = index === range.start.word ? range.start.offset : 0;
    var to = index === range.end.word ? range.end.offset : symbols.length;
    if (from < to)
      result.push({
        text: symbols
          .slice(from, to)
          .map(function (s) {
            return s.text;
          })
          .join(""),
        boxes: symbols.slice(from, to),
      });
  }
  return result;
}
function textForSelection(words, range) {
  return pieces(words, range).reduce(function (text, piece) {
    if (!text) return piece.text;
    if (/^[,.;:!?%)\]}]/.test(piece.text) || /[(\[{]$/.test(text))
      return text + piece.text;
    return text + " " + piece.text;
  }, "");
}
function highlightBoxes(words, range) {
  return pieces(words, range).reduce(function (boxes, piece) {
    return boxes.concat(piece.boxes);
  }, []);
}
function handleBox(words, range, side) {
  if (!range) return null;
  var part = side === "start" ? range.start : range.end;
  var word = words[part.word],
    symbols = usableSymbols(word);
  if (!symbols)
    return {
      x: side === "start" ? word.x : word.x + word.width,
      y: word.y,
      height: word.height,
    };
  var symbol = symbols[Math.min(part.offset, symbols.length - 1)];
  return {
    x: part.offset === symbols.length ? symbol.x + symbol.width : symbol.x,
    y: symbol.y,
    height: symbol.height,
  };
}
