import QtQuick
import QtQuick.Shapes

Item {
    id: root

    default property alias content: content.data
    property bool expanded: true
    property color color: Tokens.surface
    property real radius: Tokens.rounding.extraLarge
    property real padding: Tokens.spacing.large
    property real offsetScale: expanded ? 0 : 1
    readonly property alias contentItem: content

    implicitWidth: content.childrenRect.width + padding * 2
    implicitHeight: content.childrenRect.height + padding * 2
    visible: offsetScale < 1
    enabled: expanded

    Behavior on offsetScale { Anim {} }

    Item {
        id: surface
        width: root.width
        height: root.height
        y: (height + 5) * root.offsetScale
        opacity: Math.max(0, Math.min(1, 1 - root.offsetScale))

        Shape {
            id: shape
            anchors.fill: parent
            readonly property real corner: Math.max(0, Math.min(root.radius, width / 2, height))
            ShapePath {
                strokeWidth: 0
                strokeColor: "transparent"
                fillColor: root.color
                startX: 0
                startY: shape.height
                PathLine { x: 0; y: shape.corner }
                PathQuad { x: shape.corner; y: 0; controlX: 0; controlY: 0 }
                PathLine { x: shape.width - shape.corner; y: 0 }
                PathQuad { x: shape.width; y: shape.corner; controlX: shape.width; controlY: 0 }
                PathLine { x: shape.width; y: shape.height }
                PathLine { x: 0; y: shape.height }
            }
        }
        Item {
            id: content
            anchors.fill: parent
            anchors.margins: root.padding
        }
    }
}
