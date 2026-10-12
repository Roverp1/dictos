import QtQuick
import QtQuick.Controls

FocusScope {
    id: root

    property string label: ""
    property alias text: editor.text
    property string placeholderText: ""
    property bool active: false
    property bool editing: false
    readonly property bool readOnly: editor.readOnly
    readonly property alias editor: editor

    signal edited(string text)
    signal requestActivate()
    signal requestEdit()
    signal clearRequested()

    implicitWidth: 280
    implicitHeight: Math.max(88, editor.contentHeight + Tokens.spacing.large * 2 + caption.implicitHeight)

    // The shell restores navigation focus when editing ends.
    onEditingChanged: {
        if (editing && enabled)
            editor.forceActiveFocus(Qt.OtherFocusReason);
    }
    onVisibleChanged: {
        if (visible && editing && enabled)
            editor.forceActiveFocus(Qt.OtherFocusReason);
    }

    Rectangle {
        id: background
        anchors.fill: parent
        radius: Tokens.rounding.small
        color: root.editing ? Tokens.surfaceContainerHighest : Tokens.surfaceContainerHigh
        border.width: root.active || root.editing ? 2 : 1
        border.color: root.active || root.editing ? Tokens.primary : Tokens.outlineVariant

        StateLayer {
            anchors.fill: parent
            radius: background.radius
            hovered: navigation.containsMouse
            pressed: navigation.pressed
            active: root.active && !root.editing
        }
        Behavior on color {
            ColorAnimation { duration: Tokens.effectsDuration; easing.type: Easing.BezierSpline; easing.bezierCurve: Tokens.effectsCurve }
        }
        Behavior on border.color {
            ColorAnimation { duration: Tokens.fastEffectsDuration }
        }
    }

    Text {
        id: caption
        anchors.top: parent.top
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.margins: Tokens.spacing.large
        text: root.label
        font: Tokens.label
        color: root.active || root.editing ? Tokens.primary : Tokens.surfaceVariantText
        elide: Text.ElideRight
    }

    ScrollView {
        objectName: "capture-scroll"
        anchors.top: caption.bottom
        anchors.bottom: parent.bottom
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.leftMargin: Tokens.spacing.large
        anchors.rightMargin: Tokens.spacing.large
        anchors.bottomMargin: Tokens.spacing.medium
        anchors.topMargin: Tokens.spacing.extraSmall
        clip: true
        // Read-only editors must let wheel input reach the surrounding list.
        wheelEnabled: root.editing
        ScrollBar.horizontal.policy: ScrollBar.AlwaysOff

        TextArea {
            id: editor
            objectName: "captureEditor"
            padding: 0
            font: Tokens.body
            color: Tokens.surfaceText
            placeholderText: root.placeholderText
            placeholderTextColor: Tokens.surfaceVariantText
            selectionColor: Qt.alpha(Tokens.primary, 0.4)
            selectedTextColor: Tokens.surfaceText
            wrapMode: TextEdit.Wrap
            textFormat: TextEdit.PlainText
            readOnly: !root.editing
            selectByMouse: root.editing
            activeFocusOnPress: root.editing
            persistentSelection: false
            background: null
            Accessible.name: root.label
            onTextEdited: root.edited(text)
        }
    }

    // This area must never cover the live editor in edit mode.
    MouseArea {
        id: navigation
        anchors.fill: parent
        enabled: root.enabled && !root.editing
        hoverEnabled: true
        acceptedButtons: Qt.LeftButton | Qt.RightButton
        cursorShape: Qt.PointingHandCursor
        onClicked: mouse => {
            if (mouse.button === Qt.RightButton) {
                root.clearRequested();
                return;
            }
            root.requestActivate();
        }
        onDoubleClicked: mouse => {
            if (mouse.button === Qt.LeftButton)
                root.requestEdit();
        }
    }
}
