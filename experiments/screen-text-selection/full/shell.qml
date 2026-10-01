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
    readonly property string nativeHelper: Quickshell.env("DICTOS_OCR_NATIVE_HELPER") || ""
    readonly property string language: Quickshell.env("DICTOS_OCR_LANG") || "eng+pol"
    readonly property string psm: Quickshell.env("DICTOS_OCR_FULL_PSM") || "3"
    readonly property string retryPsm: Quickshell.env("DICTOS_OCR_RETRY_PSM") || "6"

    Variants {
        model: Quickshell.screens

        PanelWindow {
            id: panel

            required property var modelData
            readonly property bool target: modelData.name === shell.outputName
            property var fullWords: []
            property var retryWords: []
            property bool usingRetry: false
            readonly property var words: usingRetry ? retryWords : fullWords
            property int dragStart: -1
            property int dragEnd: -1
            property var entryRange: null
            property var contextRange: null
            property var entrySelectionWords: []
            property var contextSelectionWords: []
            property var dragRange: null
            property var dragAnchor: null
            property bool preciseDrag: false
            property bool cropping: false
            property var cropStart: null
            property var cropEnd: null
            property bool retryLoading: false
            property int retryElapsedMs: 0
            readonly property var entryBoxes: Selection.highlightBoxes(activeField === "Entry" && dragRange ? words : entrySelectionWords, activeField === "Entry" && dragRange ? dragRange : entryRange)
            readonly property var contextBoxes: Selection.highlightBoxes(activeField === "Context" && dragRange ? words : contextSelectionWords, activeField === "Context" && dragRange ? dragRange : contextRange)
            readonly property var activeRange: activeField === "Entry" ? entryRange : contextRange
            readonly property var activeSelectionWords: activeField === "Entry" ? entrySelectionWords : contextSelectionWords
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

            function pixelAt(localX, localY) {
                if (screenshot.status !== Image.Ready ||
                    screenshot.sourceSize.width <= 0 || screenshot.sourceSize.height <= 0 ||
                    screenshot.paintedWidth <= 0 || screenshot.paintedHeight <= 0)
                    return null

                const left = (screenshot.width - screenshot.paintedWidth) / 2
                const top = (screenshot.height - screenshot.paintedHeight) / 2
                if (localX < left || localY < top ||
                    localX >= left + screenshot.paintedWidth ||
                    localY >= top + screenshot.paintedHeight)
                    return null

                const pixelX = (localX - left) * screenshot.sourceSize.width / screenshot.paintedWidth
                const pixelY = (localY - top) * screenshot.sourceSize.height / screenshot.paintedHeight
                return { x: pixelX, y: pixelY }
            }

            function applyRange(range, sourceWords) {
                if (!range) return
                const selectedWords = sourceWords || words
                const text = Selection.textForSelection(selectedWords, range)
                if (activeField === "Entry") {
                    entrySelectionWords = selectedWords
                    entryRange = range
                    entryInput.text = text
                    entryInput.forceActiveFocus()
                } else {
                    contextSelectionWords = selectedWords
                    contextRange = range
                    contextInput.text = text
                    contextInput.forceActiveFocus()
                }
            }

            function finishSelection() {
                if (dragStart < 0 || dragEnd < 0) {
                    dragStart = -1
                    dragEnd = -1
                    return
                }

                applyRange(dragRange, words)
                dragStart = -1
                dragEnd = -1
                dragRange = null
                dragAnchor = null
            }

            function clearActive() {
                if (activeField === "Entry") {
                    entryRange = null
                    entrySelectionWords = []
                    entryInput.text = ""
                    entryInput.forceActiveFocus()
                } else {
                    contextRange = null
                    contextSelectionWords = []
                    contextInput.text = ""
                    contextInput.forceActiveFocus()
                }
            }

            function finishCrop() {
                cropping = false
                if (!cropStart || !cropEnd || retryLoading) return
                const x = Math.floor(Math.min(cropStart.x, cropEnd.x))
                const y = Math.floor(Math.min(cropStart.y, cropEnd.y))
                const right = Math.ceil(Math.max(cropStart.x, cropEnd.x))
                const bottom = Math.ceil(Math.max(cropStart.y, cropEnd.y))
                cropStart = null
                cropEnd = null
                if (right - x < 8 || bottom - y < 8) {
                    errorText = "Drag a larger area for the OCR retry."
                    return
                }
                retryLoading = true
                errorText = ""
                retryOcr.command = ["bun", shell.helperPath, shell.imagePath, shell.language,
                                    shell.retryPsm, String(x), String(y), String(right - x), String(bottom - y)]
                retryOcr.running = true
            }

            Process {
                id: ocr
                command: shell.nativeHelper ? [shell.nativeHelper, shell.imagePath, shell.language, shell.psm] :
                                              ["bun", shell.helperPath, shell.imagePath, shell.language, shell.psm]

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
                        panel.fullWords = result.words
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

            Process {
                id: retryOcr
                stdout: StdioCollector {
                    onStreamFinished: {
                        let result
                        try {
                            result = JSON.parse(text.trim())
                        } catch (error) {
                            panel.retryLoading = false
                            panel.errorText = "Invalid OCR retry response."
                            return
                        }
                        panel.retryLoading = false
                        if (result.error || !Array.isArray(result.words) || !result.region) {
                            panel.errorText = result.error || "Invalid OCR retry result."
                            return
                        }
                        if (result.words.length === 0) {
                            panel.errorText = "No text recognized in that area."
                            return
                        }
                        panel.retryWords = result.words.map(word => Object.assign({}, word, {
                            x: word.x + result.region.x,
                            y: word.y + result.region.y
                        }))
                        panel.retryElapsedMs = Number(result.elapsedMs) || 0
                        panel.usingRetry = true
                        panel.errorText = ""
                    }
                }
                onExited: (exitCode, exitStatus) => {
                    if (exitCode !== 0 && panel.retryLoading) {
                        panel.retryLoading = false
                        panel.errorText = "OCR retry failed (exit " + exitCode + ")."
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
                        if ((!shell.nativeHelper && !shell.helperPath) || !shell.imagePath) {
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
                        model: panel.usingRetry ? panel.retryWords : []
                        Rectangle {
                            required property var modelData
                            x: (screenshot.width - screenshot.paintedWidth) / 2 + modelData.x * screenshot.paintedWidth / screenshot.sourceSize.width
                            y: (screenshot.height - screenshot.paintedHeight) / 2 + modelData.y * screenshot.paintedHeight / screenshot.sourceSize.height
                            width: modelData.width * screenshot.paintedWidth / screenshot.sourceSize.width
                            height: modelData.height * screenshot.paintedHeight / screenshot.sourceSize.height
                            color: "transparent"
                            border.color: "#80cbdbee"
                            border.width: 1
                        }
                    }

                    Repeater {
                        model: panel.contextBoxes
                        Rectangle {
                            required property var modelData
                            x: (screenshot.width - screenshot.paintedWidth) / 2 + modelData.x * screenshot.paintedWidth / screenshot.sourceSize.width
                            y: (screenshot.height - screenshot.paintedHeight) / 2 + modelData.y * screenshot.paintedHeight / screenshot.sourceSize.height
                            width: modelData.width * screenshot.paintedWidth / screenshot.sourceSize.width
                            height: modelData.height * screenshot.paintedHeight / screenshot.sourceSize.height
                            color: "#80ffb66d"
                            border.color: "#ffe0b1"
                            radius: 2
                        }
                    }
                    Repeater {
                        model: panel.entryBoxes
                        Rectangle {
                            required property var modelData
                            x: (screenshot.width - screenshot.paintedWidth) / 2 + modelData.x * screenshot.paintedWidth / screenshot.sourceSize.width
                            y: (screenshot.height - screenshot.paintedHeight) / 2 + modelData.y * screenshot.paintedHeight / screenshot.sourceSize.height
                            width: modelData.width * screenshot.paintedWidth / screenshot.sourceSize.width
                            height: modelData.height * screenshot.paintedHeight / screenshot.sourceSize.height
                            color: "#806bb8ff"
                            border.color: "#b9d9ff"
                            radius: 2
                        }
                    }

                    MouseArea {
                        anchors.fill: parent
                        hoverEnabled: false
                        cursorShape: Qt.IBeamCursor
                        onPressed: mouse => {
                            const pixel = panel.pixelAt(mouse.x, mouse.y)
                            if ((mouse.modifiers & Qt.AltModifier) !== 0 && pixel) {
                                panel.cropping = true
                                panel.cropStart = pixel
                                panel.cropEnd = pixel
                                panel.dragRange = null
                                panel.dragStart = -1
                                panel.dragEnd = -1
                                return
                            }
                            const found = pixel ? Selection.hit(panel.words, pixel.x, pixel.y) : -1
                            panel.dragStart = found
                            panel.dragEnd = found
                            panel.dragAnchor = pixel
                            panel.preciseDrag = (mouse.modifiers & Qt.ControlModifier) !== 0
                            panel.dragRange = found < 0 ? null : Selection.rangeAt(panel.words, pixel, pixel, panel.preciseDrag)
                        }
                        onPositionChanged: mouse => {
                            if (panel.cropping) {
                                const pixel = panel.pixelAt(mouse.x, mouse.y)
                                if (pixel) panel.cropEnd = pixel
                                return
                            }
                            if (panel.dragStart < 0) return
                            const pixel = panel.pixelAt(mouse.x, mouse.y)
                            if (!pixel) return
                            const found = Selection.hit(panel.words, pixel.x, pixel.y)
                            if (found >= 0) {
                                panel.dragEnd = found
                                panel.dragRange = Selection.rangeAt(panel.words, panel.dragAnchor, pixel, panel.preciseDrag)
                            }
                        }
                        onReleased: mouse => {
                            if (panel.cropping) {
                                const pixel = panel.pixelAt(mouse.x, mouse.y)
                                if (pixel) panel.cropEnd = pixel
                                panel.finishCrop()
                                return
                            }
                            panel.finishSelection()
                        }
                        onCanceled: {
                            panel.cropping = false
                            panel.cropStart = null
                            panel.cropEnd = null
                            panel.dragStart = -1
                            panel.dragEnd = -1
                            panel.dragRange = null
                            panel.dragAnchor = null
                        }
                    }

                    Rectangle {
                        visible: panel.cropping && panel.cropStart && panel.cropEnd
                        x: (screenshot.width - screenshot.paintedWidth) / 2 + Math.min(panel.cropStart?.x ?? 0, panel.cropEnd?.x ?? 0) * screenshot.paintedWidth / screenshot.sourceSize.width
                        y: (screenshot.height - screenshot.paintedHeight) / 2 + Math.min(panel.cropStart?.y ?? 0, panel.cropEnd?.y ?? 0) * screenshot.paintedHeight / screenshot.sourceSize.height
                        width: Math.abs((panel.cropStart?.x ?? 0) - (panel.cropEnd?.x ?? 0)) * screenshot.paintedWidth / screenshot.sourceSize.width
                        height: Math.abs((panel.cropStart?.y ?? 0) - (panel.cropEnd?.y ?? 0)) * screenshot.paintedHeight / screenshot.sourceSize.height
                        color: "#3349baf0"
                        border.color: "#a8d9ff"
                        border.width: 2
                    }

                    Repeater {
                        model: panel.activeRange && !panel.dragRange ? 2 : 0
                        Rectangle {
                            id: handle
                            required property int index
                            readonly property string side: index === 0 ? "start" : "end"
                            readonly property var edge: Selection.handleBox(panel.activeSelectionWords, panel.activeRange, side)
                            x: (screenshot.width - screenshot.paintedWidth) / 2 + edge.x * screenshot.paintedWidth / screenshot.sourceSize.width - width / 2
                            y: (screenshot.height - screenshot.paintedHeight) / 2 + (edge.y + (index === 0 ? 0 : edge.height)) * screenshot.paintedHeight / screenshot.sourceSize.height - height / 2
                            width: 18
                            height: 18
                            radius: 9
                            color: panel.activeField === "Entry" ? "#b9d9ff" : "#ffe0b1"
                            border.color: "#1a2435"
                            border.width: 2
                            MouseArea {
                                anchors.fill: parent
                                cursorShape: Qt.SizeHorCursor
                                onPositionChanged: mouse => {
                                    if (!pressed) return
                                    const point = mapToItem(screenshot, mouse.x, mouse.y)
                                    const pixel = panel.pixelAt(point.x, point.y)
                                    if (pixel) panel.applyRange(Selection.moveHandle(panel.activeSelectionWords, panel.activeRange, handle.side, pixel.x, pixel.y), panel.activeSelectionWords)
                                }
                            }
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
                        text: "Drag words · Ctrl+drag symbols · Alt+drag OCR retry · Esc to close"
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
                                text: panel.errorText ? panel.errorText : panel.retryLoading ? "Retrying OCR…" : panel.loading ? "Recognizing text…" :
                                      panel.usingRetry ? "Retry: " + panel.retryWords.length + " words · " + panel.retryElapsedMs + " ms" :
                                      panel.fullWords.length ? panel.fullWords.length + " words · " + panel.elapsedMs + " ms" : "No text detected"
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
                                width: Math.max(0, parent.width - 242)
                                elide: Text.ElideRight
                                anchors.verticalCenter: parent.verticalCenter
                            }
                            Rectangle {
                                width: 82
                                height: parent.height
                                radius: 7
                                color: panel.retryWords.length ? "#425d77" : "#303c4d"
                                Text { anchors.centerIn: parent; text: panel.usingRetry ? "Full OCR" : "Retry OCR"; color: "white" }
                                MouseArea {
                                    anchors.fill: parent
                                    enabled: panel.retryWords.length > 0
                                    onClicked: panel.usingRetry = !panel.usingRetry
                                }
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
