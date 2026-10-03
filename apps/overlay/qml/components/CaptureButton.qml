import QtQuick
import QtQuick.Controls

AbstractButton {
    id: root

    property bool active: false
    property bool prominent: false
    property font fontStyle: Tokens.body
    readonly property color foreground: !enabled ? Qt.alpha(Tokens.surfaceText, 0.38)
        : prominent ? Tokens.primaryText : Tokens.secondaryContainerText

    implicitWidth: label.implicitWidth + Tokens.spacing.medium * 2
    implicitHeight: Math.max(40, label.implicitHeight + Tokens.spacing.small * 2)
    padding: Tokens.spacing.small
    leftPadding: Tokens.spacing.medium
    rightPadding: Tokens.spacing.medium
    hoverEnabled: true
    focusPolicy: Qt.TabFocus
    Accessible.name: text

    contentItem: Text {
        id: label
        text: root.text
        color: root.foreground
        font: root.fontStyle
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        elide: Text.ElideRight
    }

    background: Rectangle {
        id: background
        radius: root.down ? Tokens.rounding.small : root.active ? Tokens.rounding.medium : Tokens.rounding.large
        color: !root.enabled ? Qt.alpha(Tokens.surfaceText, 0.1)
            : root.prominent ? Tokens.primary : Tokens.secondaryContainer
        border.width: root.active || root.visualFocus ? 2 : 0
        border.color: Tokens.primary

        StateLayer {
            anchors.fill: parent
            radius: background.radius
            color: root.foreground
            hovered: root.hovered
            pressed: root.down
            active: root.active || root.visualFocus
        }
        Behavior on radius { Anim { type: Anim.DefaultEffects } }
        Behavior on color {
            ColorAnimation { duration: Tokens.effectsDuration; easing.type: Easing.BezierSpline; easing.bezierCurve: Tokens.effectsCurve }
        }
    }
}
