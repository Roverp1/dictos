function repair(nodes, activeId) {
  var previous = null;
  for (var i = 0; i < nodes.length; ++i) {
    if (nodes[i].id !== activeId) continue;
    if (nodes[i].enabled) return activeId;
    previous = nodes[i];
  }
  if (previous) {
    var best = null;
    var bestDistance = Infinity;
    for (var index = 0; index < nodes.length; ++index) {
      var candidate = nodes[index];
      if (!candidate.enabled || candidate.section !== previous.section)
        continue;
      var dx =
        candidate.x + candidate.width / 2 - previous.x - previous.width / 2;
      var dy =
        candidate.y + candidate.height / 2 - previous.y - previous.height / 2;
      var distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    if (best) return best.id;
  }
  for (var j = 0; j < nodes.length; ++j) {
    if (nodes[j].enabled) return nodes[j].id;
  }
  return null;
}

function switchColumn(nodes, activeId, direction) {
  var current = null;
  for (var i = 0; i < nodes.length; ++i) {
    if (nodes[i].enabled && nodes[i].id === activeId) current = nodes[i];
  }
  if (!current) return repair(nodes, activeId);
  if (!direction) return null;
  var sections = ["senses", "config", "results"];
  var step = direction > 0 ? 1 : -1;
  for (
    var column = sections.indexOf(current.section) + step;
    column >= 0 && column < sections.length;
    column += step
  ) {
    var best = null;
    var bestDistance = Infinity;
    for (var j = 0; j < nodes.length; ++j) {
      var candidate = nodes[j];
      if (!candidate.enabled || candidate.section !== sections[column])
        continue;
      var distance = Math.abs(
        candidate.y + candidate.height / 2 - current.y - current.height / 2
      );
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    if (best) return best.id;
  }
  return null;
}

function move(nodes, activeId, dx, dy) {
  var current = null;
  for (var i = 0; i < nodes.length; ++i) {
    if (nodes[i].enabled && nodes[i].id === activeId) current = nodes[i];
  }
  if (!current) return repair(nodes, activeId);
  if ((!dx && !dy) || (dx && dy)) return null;

  var horizontal = dx !== 0;
  var best = null;
  var bestAligned = false;
  var bestDistance = Infinity;
  for (var j = 0; j < nodes.length; ++j) {
    var candidate = nodes[j];
    if (!candidate.enabled || candidate.id === activeId) continue;
    var cx = candidate.x + candidate.width / 2 - current.x - current.width / 2;
    var cy =
      candidate.y + candidate.height / 2 - current.y - current.height / 2;
    if ((horizontal ? cx * dx : cy * dy) <= 0) continue;
    var aligned = horizontal
      ? candidate.y < current.y + current.height &&
        candidate.y + candidate.height > current.y
      : candidate.x < current.x + current.width &&
        candidate.x + candidate.width > current.x;
    var distance = cx * cx + cy * cy;
    // Strict comparisons keep equal candidates in the caller's stable order.
    if (
      !best ||
      (aligned && !bestAligned) ||
      (aligned === bestAligned && distance < bestDistance)
    ) {
      best = candidate;
      bestAligned = aligned;
      bestDistance = distance;
    }
  }
  return best ? best.id : null;
}
