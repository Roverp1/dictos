import QtQuick

NumberAnimation {
    enum Type { DefaultSpatial, FastSpatial, DefaultEffects, FastEffects }
    property int type: Anim.DefaultSpatial

    duration: type === Anim.FastSpatial ? Tokens.fastSpatialDuration
        : type === Anim.DefaultEffects ? Tokens.effectsDuration
        : type === Anim.FastEffects ? Tokens.fastEffectsDuration : Tokens.spatialDuration
    easing.type: Easing.BezierSpline
    easing.bezierCurve: type === Anim.FastSpatial ? Tokens.fastSpatialCurve
        : type === Anim.DefaultEffects ? Tokens.effectsCurve
        : type === Anim.FastEffects ? Tokens.fastEffectsCurve : Tokens.spatialCurve
}
