pragma Singleton

import QtQuick

QtObject {
    property color surface: "#191114"
    property color surfaceContainerLow: "#22191c"
    property color surfaceContainer: "#261d20"
    property color surfaceContainerHigh: "#31282a"
    property color surfaceContainerHighest: "#3c3235"
    property color surfaceText: "#efdfe2"
    property color surfaceVariantText: "#d5c2c6"
    property color outline: "#9e8c91"
    property color outlineVariant: "#514347"
    property color primary: "#ffb0ca"
    property color primaryText: "#541d34"
    property color primaryContainer: "#6f334a"
    property color primaryContainerText: "#ffd9e3"
    property color secondaryContainer: "#5a3f48"
    property color secondaryContainerText: "#ffd9e3"
    property color error: "#ffb4ab"

    // Use installed fonts; Qt supplies a fallback when the upstream family is absent.
    property string fontFamily: "GoogleSansFlex"
    property string monoFamily: "CaskaydiaCove NF"
    readonly property font body: Qt.font({ family: fontFamily, pointSize: 12, variableAxes: { ROND: 25 } })
    readonly property font label: Qt.font({ family: fontFamily, pointSize: 11, variableAxes: { ROND: 25 } })
    readonly property font title: Qt.font({ family: fontFamily, pointSize: 14, weight: Font.Medium, variableAxes: { ROND: 25 } })

    readonly property TokenScale spacing: TokenScale {}
    readonly property TokenScale rounding: TokenScale {}

    component TokenScale: QtObject {
        readonly property int extraSmall: 4
        readonly property int small: 8
        readonly property int medium: 12
        readonly property int large: 16
        readonly property int largeIncreased: 20
        readonly property int extraLarge: 28
        readonly property int extraLargeIncreased: 32
        readonly property int extraExtraLarge: 48
    }
    readonly property int spatialDuration: 500
    readonly property int fastSpatialDuration: 350
    readonly property int effectsDuration: 200
    readonly property int fastEffectsDuration: 150
    readonly property list<real> spatialCurve: [0.38, 1.21, 0.22, 1, 1, 1]
    readonly property list<real> fastSpatialCurve: [0.42, 1.67, 0.21, 0.9, 1, 1]
    readonly property list<real> effectsCurve: [0.34, 0.8, 0.34, 1, 1, 1]
    readonly property list<real> fastEffectsCurve: [0.31, 0.94, 0.34, 1, 1, 1]
}
