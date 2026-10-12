import QtQuick

// Adapted from Omarchy shell/Ui/PanelKeyCatcher.qml.
Item {
  id: root

  property string mode: "navigation"

  signal move(int dx, int dy)
  signal activate()
  signal edit()
  signal back()
  signal switchColumn(int direction)
  signal openDrawer()
  signal closeDrawer()
  signal undo()
  signal redo()
  signal clear()
  signal tab(int direction)

  focus: true
  Keys.priority: Keys.BeforeItem
  // Editors must forward keys here so deliberate shortcuts run before text handling.
  Keys.onPressed: function(event) {
    event.accepted = false
    var ctrl = (event.modifiers & Qt.ControlModifier) !== 0
    var shift = (event.modifiers & Qt.ShiftModifier) !== 0
    if (event.modifiers & (Qt.AltModifier | Qt.MetaModifier)) return

    if (mode !== "popup" && ctrl && !shift) {
      if (event.key === Qt.Key_H || event.key === Qt.Key_L) {
        switchColumn(event.key === Qt.Key_H ? -1 : 1)
        event.accepted = true; return
      }
      if (event.key === Qt.Key_K) {
        openDrawer(); event.accepted = true; return
      }
      if (event.key === Qt.Key_J) {
        closeDrawer(); event.accepted = true; return
      }
    }
    if (mode === "navigation" && ctrl) {
      if (event.key === Qt.Key_Z) {
        if (shift) redo()
        else undo()
        event.accepted = true; return
      }
      if (event.key === Qt.Key_R && !shift) {
        redo(); event.accepted = true; return
      }
    }
    if (ctrl) return
    if (event.key === Qt.Key_Escape && !shift) {
      back(); event.accepted = true; return
    }
    if (mode !== "navigation" && mode !== "popup") return
    if (mode === "navigation" && (event.key === Qt.Key_Tab || event.key === Qt.Key_Backtab)) {
      tab(shift || event.key === Qt.Key_Backtab ? -1 : 1)
      event.accepted = true; return
    }
    if (shift) return
    if (event.key === Qt.Key_Down || event.text === "j") {
      move(0, 1); event.accepted = true; return
    }
    if (event.key === Qt.Key_Up || event.text === "k") {
      move(0, -1); event.accepted = true; return
    }
    if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
      activate(); event.accepted = true; return
    }
    if (event.key === Qt.Key_Right || (mode === "navigation" && event.text === "l")) {
      move(1, 0); event.accepted = true; return
    }
    if (event.key === Qt.Key_Left || (mode === "navigation" && event.text === "h")) {
      move(-1, 0); event.accepted = true; return
    }
    if (mode === "popup") return
    if (event.text === "i") {
      edit(); event.accepted = true; return
    }
    if (event.text === "d" || event.key === Qt.Key_Backspace) {
      clear(); event.accepted = true; return
    }
    if (event.text === "u") {
      undo(); event.accepted = true; return
    }
  }
}
