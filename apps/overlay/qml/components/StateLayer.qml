import QtQuick

Rectangle {
    property bool hovered: false
    property bool pressed: false
    property bool active: false
    color: Tokens.surfaceText
    opacity: !enabled ? 0 : pressed ? 0.1 : active ? 0.12 : hovered ? 0.08 : 0

    Behavior on opacity { Anim { type: Anim.DefaultEffects } }
}
