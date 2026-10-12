pragma ComponentBehavior: Bound

import QtQuick
import QtQuick.Controls

ListView {
    id: root

    clip: true
    spacing: Tokens.spacing.small
    maximumFlickVelocity: 3000
    boundsBehavior: Flickable.StopAtBounds
    highlightMoveDuration: Tokens.spatialDuration
    highlightResizeDuration: Tokens.effectsDuration
    highlightFollowsCurrentItem: false
    rebound: Transition { Anim { properties: "x,y" } }

    // Navigation chooses when to reveal an item; model updates do not steal the cursor.
    function revealIndex(index: int): void {
        if (index >= 0 && index < count)
            positionViewAtIndex(index, ListView.Contain);
    }

    ScrollBar.vertical: ScrollBar {
        id: scrollBar
        policy: ScrollBar.AsNeeded
        contentItem: Rectangle {
            implicitWidth: Tokens.spacing.extraSmall
            radius: Tokens.rounding.extraSmall
            color: Tokens.outline
            opacity: scrollBar.pressed ? 1 : scrollBar.active ? 0.7 : 0.35
            Behavior on opacity { Anim { type: Anim.DefaultEffects } }
        }
    }
}
