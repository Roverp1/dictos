import QtQuick

// Adapted from Omarchy shell/Ui/PointerMoveGate.qml.
QtObject {
  id: root

  property Item referenceItem: null
  property real threshold: 1
  property bool primed: false
  property bool initialSampleAllowed: false
  property real lastX: 0
  property real lastY: 0

  function reset() {
    root.primed = false
    root.initialSampleAllowed = false
    root.lastX = 0
    root.lastY = 0
  }

  function allowInitialSample() {
    root.reset()
    root.initialSampleAllowed = true
  }

  function moved(item, mouse) {
    if (!item || !mouse) {
      root.reset()
      return false
    }

    // Local coordinates change during animation even when the pointer is still.
    var point = root.referenceItem
      ? item.mapToItem(root.referenceItem, mouse.x, mouse.y)
      : item.mapToGlobal(mouse.x, mouse.y)
    var firstSample = !root.primed
    var didMove = !firstSample
      ? Math.abs(point.x - root.lastX) > root.threshold || Math.abs(point.y - root.lastY) > root.threshold
      : root.initialSampleAllowed

    // Retain the accepted position so small deliberate steps accumulate past jitter.
    if (firstSample || didMove) {
      root.lastX = point.x
      root.lastY = point.y
    }
    root.primed = true
    root.initialSampleAllowed = false
    return didMove
  }
}
