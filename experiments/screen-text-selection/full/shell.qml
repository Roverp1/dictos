pragma ComponentBehavior: Bound

import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import "selection.js" as Selection

ShellRoot {
    id: shell

    readonly property string imageUrl: Quickshell.env("DICTOS_OCR_IMAGE_URL") || ""
    readonly property string imagePath: Quickshell.env("DICTOS_OCR_IMAGE") || ""
    readonly property string outputName: Quickshell.env("DICTOS_OCR_OUTPUT") || ""
    readonly property string helperPath: Quickshell.env("DICTOS_OCR_HELPER") || ""
    readonly property string language: Quickshell.env("DICTOS_OCR_LANG") || "eng+pol"
    readonly property string psm: Quickshell.env("DICTOS_OCR_FULL_PSM") || "3"

    Variants {
        model: Quickshell.screens

        PanelWindow {
            id: panel

            required property var modelData
            readonly property bool target: modelData.name === shell.outputName
            property var words: []
            property int entryStart: -1
            property int entryEnd: -1
            property int contextStart: -1
            property int contextEnd: -1
            property int dragStart: -1
            property int dragEnd: -1
            property string activeField: "Entry"
            property bool loading: false
            property bool requested: false
            property string errorText: ""
            property int elapsedMs: 0

            screen: modelData
            visible: target
            anchors { left: true; right: true; top: true; bottom: true }
            exclusionMode: ExclusionMode.Ignore
            focusable: true
            WlrLayershell.layer: WlrLayer.Overlay
            WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive
            WlrLayershell.namespace: "dictos-screen-text-selection-full"

            function indexAt(localX, localY) {
                if (screenshot.status !== Image.Ready || words.length === 0 ||
                    screenshot.sourceSize.width <= 0 || screenshot.sourceSize.height <= 0 ||
                    screenshot.paintedWidth <= 0 || screenshot.paintedHeight <= 0)
                    return -1

                const left = (screenshot.width - screenshot.paintedWidth) / 2
                const top = (screenshot.height - screenshot.paintedHeight) / 2
                if (localX < left || localY < top ||
                    localX >= left + screenshot.paintedWidth ||
                    localY >= top + screenshot.paintedHeight)
                    return -1

                const pixelX = (localX - left) * screenshot.sourceSize.width / screenshot.paintedWidth
                const pixelY = (localY - top) * screenshot.sourceSize.height / screenshot.paintedHeight
                return Selection.hit(words, pixelX, pixelY)
            }

            function finishSelection() {
                if (dragStart < 0 || dragEnd < 0) {
                    dragStart = -1
                    dragEnd = -1
                    return
                }

                const text = Selection.textForRange(words, dragStart, dragEnd)
                if (activeField === "Entry") {
                    entryStart = dragStart
                    entryEnd = dragEnd
                    entryInput.text = text
                    entryInput.forceActiveFocus()
                } else {
                    contextStart = dragStart
                    contextEnd = dragEnd
                    contextInput.text = text
                    contextInput.forceActiveFocus()
                }
                dragStart = -1
                dragEnd = -1
            }

            function clearActive() {
                if (activeField === "Entry") {
                    entryStart = -1
                    entryEnd = -1
                    entryInput.text = ""
                    entryInput.forceActiveFocus()
                } else {
                    contextStart = -1
                    contextEnd = -1
                    contextInput.text = ""
                    contextInput.forceActiveFocus()
                }
            }

            Process {
                id: ocr
                command: ["bun", shell.helperPath, shell.imagePath, shell.language, shell.psm]

                stdout: StdioCollector {
                    onStreamFinished: {
                        const raw = text.trim()
                        if (!raw) {
                            panel.loading = false
                            panel.errorText = "OCR returned no result."
                            return
                        }

                        let result
                        try {
                            result = JSON.parse(raw)
                        } catch (error) {
                            panel.loading = false
                            panel.errorText = "Invalid OCR response."
                            return
                        }
                        panel.loading = false
                        if (result.error) {
                            panel.errorText = String(result.error)
                            return
                        }
                        if (!Array.isArray(result.words)) {
                            panel.errorText = "OCR returned an invalid result."
                            return
                        }
                        panel.words = result.words
                        panel.elapsedMs = Number(result.elapsedMs) || 0
                    }
                }

                onExited: (exitCode, exitStatus) => {
                    if (exitCode !== 0 && panel.loading) {
                        panel.loading = false
                        panel.errorText = "OCR failed (exit " + exitCode + ")."
                    }
                }
            }

            Item {
                id: surface
                anchors.fill: parent
                focus: true

                Shortcut {
                    sequence: "Esc"
                    onActivated: Qt.quit()
                }

                Rectangle {
                    anchors.fill: parent
                    color: "#101620"
                }

                Image {
                    id: screenshot
                    anchors.fill: parent
                    source: panel.target ? shell.imageUrl : ""
                    fillMode: Image.PreserveAspectFit
                    asynchronous: true
                    cache: false

                    Component.onCompleted: {
                        if (panel.target && !shell.imageUrl)
                            panel.errorText = "Missing screenshot URL."
                    }

                    onStatusChanged: {
                        if (!panel.target || panel.requested) return
                        if (status === Image.Error) {
                            panel.errorText = "Could not load the screenshot."
                            return
                        }
                        if (status !== Image.Ready) return
                        if (!shell.helperPath || !shell.imagePath) {
                            panel.errorText = "Missing OCR image or helper path."
                            return
                        }
                        panel.requested = true
                        panel.loading = true
                        ocr.running = true
                    }

                    Rectangle {
                        anchors.fill: parent
                        color: "#260c1320"
                    }

                    Repeater {
                        model: panel.words.length

                        Rectangle {
                            required property int index
                            readonly property var word: panel.words[index]
                            readonly property bool entryMarked: Selection.contains(index, panel.entryStart, panel.entryEnd) ||
                                                                 (panel.activeField === "Entry" && Selection.contains(index, panel.dragStart, panel.dragEnd))
                            readonly property bool contextMarked: Selection.contains(index, panel.contextStart, panel.contextEnd) ||
                                                                   (panel.activeField === "Context" && Selection.contains(index, panel.dragStart, panel.dragEnd))

                            x: (screenshot.width - screenshot.paintedWidth) / 2 + word.x * screenshot.paintedWidth / screenshot.sourceSize.width
                            y: (screenshot.height - screenshot.paintedHeight) / 2 + word.y * screenshot.paintedHeight / screenshot.sourceSize.height
                            width: word.width * screenshot.paintedWidth / screenshot.sourceSize.width
                            height: word.height * screenshot.paintedHeight / screenshot.sourceSize.height
                            visible: entryMarked || contextMarked
                            color: entryMarked && contextMarked ? "#a0ad8add" : entryMarked ? "#806bb8ff" : "#80ffb66d"
                            border.color: entryMarked && contextMarked ? "#d9c2ee" : entryMarked ? "#b9d9ff" : "#ffe0b1"
                            border.width: 1
                            radius: 2
                        }
                    }

                    MouseArea {
                        anchors.fill: parent
                        hoverEnabled: false
                        cursorShape: Qt.IBeamCursor
                        onPressed: mouse => {
                            const found = panel.indexAt(mouse.x, mouse.y)
                            panel.dragStart = found
                            panel.dragEnd = found
                        }
                        onPositionChanged: mouse => {
                            if (panel.dragStart < 0) return
                            const found = panel.indexAt(mouse.x, mouse.y)
                            if (found >= 0) panel.dragEnd = found
                        }
                        onReleased: panel.finishSelection()
                        onCanceled: {
                            panel.dragStart = -1
                            panel.dragEnd = -1
                        }
                    }
                }

                Rectangle {
                    id: hint
                    anchors.top: parent.top
                    anchors.horizontalCenter: parent.horizontalCenter
                    anchors.topMargin: 20
                    width: Math.min(parent.width - 32, hintText.implicitWidth + 36)
                    height: 42
                    radius: 12
                    color: "#e81a2435"
                    border.color: "#66768ba4"

                    Text {
                        id: hintText
                        anchors.centerIn: parent
                        text: "Drag across text to fill " + panel.activeField + "  ·  Switch fields below  ·  Esc to close"
                        color: "#f7f9ff"
                        font.pixelSize: 14
                        elide: Text.ElideRight
                        width: Math.min(implicitWidth, hint.width - 24)
                    }
                }

                Rectangle {
                    id: editor
                    anchors.bottom: parent.bottom
                    anchors.horizontalCenter: parent.horizontalCenter
                    anchors.bottomMargin: 22
                    width: Math.min(parent.width - 32, 880)
                    height: 215
                    radius: 16
                    color: "#f21a2435"
                    border.color: "#65768ba4"

                    Column {
                        anchors.fill: parent
                        anchors.margins: 14
                        spacing: 9

                        Row {
                            width: parent.width
                            height: 28
                            spacing: 8

                            Text {
                                text: "Dictos · screen text"
                                color: "#f7f9ff"
                                font.bold: true
                                font.pixelSize: 15
                                width: 200
                                anchors.verticalCenter: parent.verticalCenter
                            }

                            Text {
                                text: panel.errorText ? panel.errorText : panel.loading ? "Recognizing text…" :
                                      panel.words.length ? panel.words.length + " words · " + panel.elapsedMs + " ms" : "No text detected"
                                color: panel.errorText ? "#ff9999" : "#bac7d7"
                                font.pixelSize: 13
                                elide: Text.ElideRight
                                width: Math.max(0, parent.width - 208)
                                anchors.verticalCenter: parent.verticalCenter
                            }
                        }

                        Row {
                            width: parent.width
                            height: 35
                            spacing: 8

                            Rectangle {
                                width: 86
                                height: parent.height
                                radius: 7
                                color: panel.activeField === "Entry" ? "#476ea0" : "#303c4d"
                                Text { anchors.centerIn: parent; text: "Entry"; color: "white"; font.bold: true }
                                MouseArea {
                                    anchors.fill: parent
                                    onClicked: { panel.activeField = "Entry"; entryInput.forceActiveFocus() }
                                }
                            }
                            Rectangle {
                                width: parent.width - 94
                                height: parent.height
                                radius: 7
                                color: "#101925"
                                border.color: panel.activeField === "Entry" ? "#91bfff" : "#53677c"
                                TextInput {
                                    id: entryInput
                                    anchors.fill: parent
                                    anchors.margins: 8
                                    color: "#ffffff"
                                    selectionColor: "#476ea0"
                                    selectedTextColor: "white"
                                    font.pixelSize: 15
                                    clip: true
                                    onActiveFocusChanged: if (activeFocus) panel.activeField = "Entry"
                                }
                            }
                        }

                        Row {
                            width: parent.width
                            height: 65
                            spacing: 8

                            Rectangle {
                                width: 86
                                height: parent.height
                                radius: 7
                                color: panel.activeField === "Context" ? "#a26939" : "#303c4d"
                                Text { anchors.centerIn: parent; text: "Context"; color: "white"; font.bold: true }
                                MouseArea {
                                    anchors.fill: parent
                                    onClicked: { panel.activeField = "Context"; contextInput.forceActiveFocus() }
                                }
                            }
                            Rectangle {
                                width: parent.width - 94
                                height: parent.height
                                radius: 7
                                color: "#101925"
                                border.color: panel.activeField === "Context" ? "#ffc38f" : "#53677c"
                                TextEdit {
                                    id: contextInput
                                    anchors.fill: parent
                                    anchors.margins: 8
                                    color: "#ffffff"
                                    selectionColor: "#a26939"
                                    selectedTextColor: "white"
                                    font.pixelSize: 15
                                    wrapMode: TextEdit.Wrap
                                    clip: true
                                    onActiveFocusChanged: if (activeFocus) panel.activeField = "Context"
                                }
                            }
                        }

                        Row {
                            width: parent.width
                            height: 32
                            spacing: 8

                            Text {
                                text: "Edit either field directly. Clear resets the active field."
                                color: "#bac7d7"
                                font.pixelSize: 12
                                width: Math.max(0, parent.width - 160)
                                elide: Text.ElideRight
                                anchors.verticalCenter: parent.verticalCenter
                            }
                            Rectangle {
                                width: 70
                                height: parent.height
                                radius: 7
                                color: "#35465a"
                                Text { anchors.centerIn: parent; text: "Clear"; color: "white" }
                                MouseArea { anchors.fill: parent; onClicked: panel.clearActive() }
                            }
                            Rectangle {
                                width: 74
                                height: parent.height
                                radius: 7
                                color: "#754653"
                                Text { anchors.centerIn: parent; text: "Close"; color: "white" }
                                MouseArea { anchors.fill: parent; onClicked: Qt.quit() }
                            }
                        }
                    }
                }
            }
        }
    }
}
