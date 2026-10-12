function distanceToBox(word, x, y) {
  const dx = Math.max(word.x - x, 0, x - word.x - word.width);
  const dy = Math.max(word.y - y, 0, y - word.y - word.height);
  return Math.hypot(dx, dy);
}

function hit(words, x, y) {
  let nearest = -1;
  let distance = Infinity;

  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    const current = distanceToBox(word, x, y);
    if (current < distance && current <= Math.max(20, word.height * 1.5)) {
      nearest = index;
      distance = current;
    }
  }

  return nearest;
}

function contains(index, start, end) {
  return (
    start >= 0 &&
    end >= 0 &&
    index >= Math.min(start, end) &&
    index <= Math.max(start, end)
  );
}

function textForRange(words, start, end) {
  if (start < 0 || end < 0 || start >= words.length || end >= words.length)
    return "";

  const selected = words.slice(Math.min(start, end), Math.max(start, end) + 1);
  return selected.reduce((text, word) => {
    if (!text) return word.text;
    if (/^[,.;:!?%)\]}]/.test(word.text)) return text + word.text;
    if (/[(\[{]$/.test(text)) return text + word.text;
    return text + " " + word.text;
  }, "");
}

function usableSymbols(word) {
  const symbols = word.symbols;
  if (
    !Array.isArray(symbols) ||
    !symbols.length ||
    symbols.map((symbol) => symbol.text).join("") !== word.text
  )
    return null;
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    if (
      typeof symbol.text !== "string" ||
      !symbol.text ||
      ![symbol.x, symbol.y, symbol.width, symbol.height].every(
        Number.isFinite
      ) ||
      symbol.width <= 0 ||
      symbol.height <= 0 ||
      symbol.x < word.x - 2 ||
      symbol.x + symbol.width > word.x + word.width + 2 ||
      symbol.y < word.y - 2 ||
      symbol.y + symbol.height > word.y + word.height + 2 ||
      (i && symbol.x < symbols[i - 1].x)
    )
      return null;
  }
  return symbols;
}

function boundary(words, wordIndex, x, side, nearest = false) {
  const word = words[wordIndex];
  const symbols = usableSymbols(word);
  if (!symbols) return { word: wordIndex, offset: side === "start" ? 0 : 1 };
  if (nearest) {
    let offset = 0;
    let distance = Infinity;
    for (let i = 0; i <= symbols.length; i++) {
      const edge =
        i === symbols.length
          ? symbols[i - 1].x + symbols[i - 1].width
          : symbols[i].x;
      if (Math.abs(x - edge) < distance) {
        distance = Math.abs(x - edge);
        offset = i;
      }
    }
    return { word: wordIndex, offset };
  }
  let index = 0;
  let distance = Infinity;
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    const current = distanceToBox(symbol, x, symbol.y + symbol.height / 2);
    if (current < distance) {
      distance = current;
      index = i;
    }
  }
  return { word: wordIndex, offset: index + (side === "end" ? 1 : 0) };
}

function wordRange(words, start, end) {
  if (start < 0 || end < 0) return null;
  return {
    start: { word: Math.min(start, end), offset: 0 },
    end: {
      word: Math.max(start, end),
      offset: usableSymbols(words[Math.max(start, end)])?.length ?? 1,
    },
    whole: true,
  };
}

function compare(a, b) {
  return a.word - b.word || a.offset - b.offset;
}

function normalized(words, a, b) {
  if (!a || !b) return null;
  const first = compare(a, b) <= 0 ? a : b;
  const last = first === a ? b : a;
  // A word without reliable symbols can only be selected as a whole.
  const start = usableSymbols(words[first.word])
    ? first
    : { word: first.word, offset: 0 };
  const end = usableSymbols(words[last.word])
    ? last
    : { word: last.word, offset: 1 };
  return { start, end };
}

function rangeAt(words, anchor, focus, precise) {
  const startIndex = hit(words, anchor.x, anchor.y);
  const endIndex = hit(words, focus.x, focus.y);
  if (startIndex < 0 || endIndex < 0) return null;
  if (!precise) return wordRange(words, startIndex, endIndex);
  const forward =
    startIndex < endIndex || (startIndex === endIndex && anchor.x <= focus.x);
  return normalized(
    words,
    boundary(words, startIndex, anchor.x, forward ? "start" : "end"),
    boundary(words, endIndex, focus.x, forward ? "end" : "start")
  );
}

function moveHandle(words, range, side, x, y) {
  if (!range) return null;
  const index = hit(words, x, y);
  if (index < 0) return range;
  const moved = boundary(words, index, x, side, true);
  // Keep start and end roles stable when dragging across the other handle.
  if (side === "start") return normalized(words, moved, range.end);
  return normalized(words, range.start, moved);
}

function pieces(words, range) {
  if (!range) return [];
  const result = [];
  for (let index = range.start.word; index <= range.end.word; index++) {
    const word = words[index];
    const symbols = usableSymbols(word);
    if (!symbols || range.whole) {
      result.push({ word: index, text: word.text, box: word });
      continue;
    }
    const from = index === range.start.word ? range.start.offset : 0;
    const to = index === range.end.word ? range.end.offset : symbols.length;
    if (from < to)
      result.push({
        word: index,
        text: symbols
          .slice(from, to)
          .map((symbol) => symbol.text)
          .join(""),
        boxes: symbols.slice(from, to),
      });
  }
  return result;
}

function textForSelection(words, range) {
  return pieces(words, range).reduce((text, piece) => {
    if (!text) return piece.text;
    if (/^[,.;:!?%)\]}]/.test(piece.text)) return text + piece.text;
    if (/[(\[{]$/.test(text)) return text + piece.text;
    return text + " " + piece.text;
  }, "");
}

function highlightBoxes(words, range) {
  const boxes = [];
  for (const piece of pieces(words, range))
    boxes.push(...(piece.boxes || [piece.box]));
  return boxes;
}

function handleBox(words, range, side) {
  if (!range) return null;
  const part = side === "start" ? range.start : range.end;
  const symbols = usableSymbols(words[part.word]);
  const word = words[part.word];
  if (!symbols)
    return {
      x: side === "start" ? word.x : word.x + word.width,
      y: word.y,
      height: word.height,
    };
  const i = Math.min(part.offset, symbols.length - 1);
  const symbol = symbols[i];
  return {
    x: part.offset === symbols.length ? symbol.x + symbol.width : symbol.x,
    y: symbol.y,
    height: symbol.height,
  };
}

function replacementText(sourceWords, range, updatedWords) {
  const selected = highlightBoxes(sourceWords, range);
  if (!selected.length || !updatedWords.length) return null;

  const intersecting = updatedWords.filter((word) =>
    selected.some((box) => {
      const width = Math.max(
        0,
        Math.min(box.x + box.width, word.x + word.width) -
          Math.max(box.x, word.x)
      );
      const height = Math.max(
        0,
        Math.min(box.y + box.height, word.y + word.height) -
          Math.max(box.y, word.y)
      );
      const smallerArea = Math.min(
        box.width * box.height,
        word.width * word.height
      );
      return smallerArea > 0 && (width * height) / smallerArea >= 0.3;
    })
  );
  return intersecting.length
    ? textForRange(intersecting, 0, intersecting.length - 1)
    : null;
}
