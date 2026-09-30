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
