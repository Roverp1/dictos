pragma ComponentBehavior: Bound

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import "selection.js" as Selection

ShellRoot {
    id: root

    readonly property string imageUrl: Quickshell.env("DICTOS_OCR_IMAGE_URL") || ""
    readonly property string imagePath: Quickshell.env("DICTOS_OCR_IMAGE") || ""
    readonly property string outputName: Quickshell.env("DICTOS_OCR_OUTPUT") || ""
    readonly property string helperPath: Quickshell.env("DICTOS_OCR_HELPER") || ""
    readonly property string language: Quickshell.env("DICTOS_OCR_LANG") || "eng+pol"
    readonly property string psm: Quickshell.env("DICTOS_OCR_REGION_PSM") || "6"

    Variants {
        model: Quickshell.screens

        PanelWindow {
        id: panel
        required property var modelData
        readonly property bool target: modelData.name === root.outputName
        screen: modelData
        visible: target
        anchors { top: true; bottom: true; left: true; right: true }
        exclusionMode: ExclusionMode.Ignore
        WlrLayershell.layer: WlrLayer.Overlay
        WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive
        color: "#10151d"

        property string activeField: "entry"
        property bool cropMode: true
        property bool dragging: false
        property bool busy: false
        property bool responseReceived: false
        property string pendingField: ""
        property string errorMessage: ""
        property int elapsedMs: -1
        property var entryWords: []
        property var contextWords: []
        property int entryStart: -1
        property int entryEnd: -1
        property int contextStart: -1
        property int contextEnd: -1
        property real dragStartX: 0
        property real dragStartY: 0
        property real dragEndX: 0
        property real dragEndY: 0
        property int rangeStart: -1

        readonly property real scaleX: screenshot.paintedWidth > 0 ? screenshot.paintedWidth / screenshot.sourceSize.width : 0
        readonly property real scaleY: screenshot.paintedHeight > 0 ? screenshot.paintedHeight / screenshot.sourceSize.height : 0
        readonly property real imageX: screenshot.x + (screenshot.width - screenshot.paintedWidth) / 2
        readonly property real imageY: screenshot.y + (screenshot.height - screenshot.paintedHeight) / 2

        function insideImage(x, y) {
            return scaleX > 0 && scaleY > 0 && x >= imageX && y >= imageY
                && x < imageX + screenshot.paintedWidth && y < imageY + screenshot.paintedHeight;
        }

        function pixelX(x) {
            return Math.max(0, Math.min(screenshot.sourceSize.width, (x - imageX) / scaleX));
        }

        function pixelY(y) {
            return Math.max(0, Math.min(screenshot.sourceSize.height, (y - imageY) / scaleY));
        }

        function wordsForField() {
            return activeField === "entry" ? entryWords : contextWords;
        }

        function chooseField(field) {
            activeField = field;
            cropMode = wordsForField().length === 0;
            errorMessage = "";
        }

        function acceptResponse(raw) {
            responseReceived = true;
            busy = false;
            if (!raw.trim()) {
                errorMessage = "OCR produced no response";
                return;
            }

            // JSON comes from a separate process, so parsing needs a failure boundary.
            let result;
            try {
                result = JSON.parse(raw);
            } catch (error) {
                errorMessage = "Invalid OCR response: " + error.message;
                return;
            }
            if (!result || result.error || !Array.isArray(result.words) || !result.region) {
                errorMessage = result && result.error ? String(result.error) : "Invalid OCR response";
                return;
            }

            const words = result.words.map(word => ({
                text: word.text,
                x: Number(word.x) + Number(result.region.x),
                y: Number(word.y) + Number(result.region.y),
                width: Number(word.width),
                height: Number(word.height),
                block: word.block,
                line: word.line,
                confidence: word.confidence
            }));
            elapsedMs = Number(result.elapsedMs);
            if (pendingField === "entry") {
                entryWords = words;
                entryStart = words.length ? 0 : -1;
                entryEnd = words.length ? words.length - 1 : -1;
                entryText.text = words.length ? Selection.textForRange(words, entryStart, entryEnd) : "";
            } else {
                contextWords = words;
                contextStart = words.length ? 0 : -1;
                contextEnd = words.length ? words.length - 1 : -1;
                contextText.text = words.length ? Selection.textForRange(words, contextStart, contextEnd) : "";
            }
            if (activeField === pendingField)
                cropMode = words.length === 0;
            errorMessage = words.length ? "" : "No text found in this region";
        }

        function finishDrag() {
            if (!dragging) return;
            dragging = false;
            if (cropMode) {
                const x = Math.floor(pixelX(Math.min(dragStartX, dragEndX)));
                const y = Math.floor(pixelY(Math.min(dragStartY, dragEndY)));
                const right = Math.ceil(pixelX(Math.max(dragStartX, dragEndX)));
                const bottom = Math.ceil(pixelY(Math.max(dragStartY, dragEndY)));
                if (right <= x || bottom <= y) return;
                if (!root.imagePath || !root.helperPath) {
                    errorMessage = "Missing OCR image or helper path";
                    return;
                }
                pendingField = activeField;
                responseReceived = false;
                errorMessage = "";
                busy = true;
                ocr.command = ["bun", root.helperPath, root.imagePath, root.language, root.psm,
                               String(x), String(y), String(right - x), String(bottom - y)];
                ocr.running = true;
                return;
            }

            const words = wordsForField();
            const end = Selection.hit(words, pixelX(dragEndX), pixelY(dragEndY));
            if (rangeStart < 0 || end < 0) return;
            const first = Math.min(rangeStart, end);
            const last = Math.max(rangeStart, end);
            if (activeField === "entry") {
                entryStart = first;
                entryEnd = last;
                entryText.text = Selection.textForRange(words, first, last);
            } else {
                contextStart = first;
                contextEnd = last;
                contextText.text = Selection.textForRange(words, first, last);
            }
        }

        Shortcut {
            sequence: "Escape"
            context: Qt.ApplicationShortcut
            onActivated: Qt.quit()
        }

        Process {
            id: ocr
            stdout: StdioCollector {
                onStreamFinished: panel.acceptResponse(text)
            }
            onExited: (exitCode, exitStatus) => {
                if (exitCode !== 0 && !panel.responseReceived)
                    exitFailure.restart();
            }
        }

        Timer {
            id: exitFailure
            interval: 100
            onTriggered: {
                if (!panel.responseReceived) {
                    panel.busy = false;
                    panel.errorMessage = "OCR process failed";
                }
            }
        }

        Image {
            id: screenshot
            anchors.fill: parent
            source: panel.target ? root.imageUrl : ""
            fillMode: Image.PreserveAspectFit
            cache: false
            asynchronous: false
        }

        MouseArea {
            id: gestureArea
            anchors.fill: parent
            enabled: !panel.busy && screenshot.status === Image.Ready
            cursorShape: panel.cropMode ? Qt.CrossCursor : Qt.IBeamCursor
            onPressed: mouse => {
                if (!panel.insideImage(mouse.x, mouse.y)) return;
                panel.dragging = true;
                panel.dragStartX = mouse.x;
                panel.dragStartY = mouse.y;
                panel.dragEndX = mouse.x;
                panel.dragEndY = mouse.y;
                panel.rangeStart = panel.cropMode ? -1
                    : Selection.hit(panel.wordsForField(), panel.pixelX(mouse.x), panel.pixelY(mouse.y));
            }
            onPositionChanged: mouse => {
                if (!panel.dragging) return;
                panel.dragEndX = mouse.x;
                panel.dragEndY = mouse.y;
            }
            onReleased: mouse => {
                panel.dragEndX = mouse.x;
                panel.dragEndY = mouse.y;
                panel.finishDrag();
            }
            onCanceled: panel.dragging = false
        }

        Rectangle {
            visible: panel.dragging && panel.cropMode
            x: Math.max(panel.imageX, Math.min(panel.dragStartX, panel.dragEndX))
            y: Math.max(panel.imageY, Math.min(panel.dragStartY, panel.dragEndY))
            width: Math.max(0, Math.min(panel.imageX + screenshot.paintedWidth,
                                         Math.max(panel.dragStartX, panel.dragEndX)) - x)
            height: Math.max(0, Math.min(panel.imageY + screenshot.paintedHeight,
                                          Math.max(panel.dragStartY, panel.dragEndY)) - y)
            color: "#3349baf0"
            border.color: "#a8d9ff"
            border.width: 2
        }

        Repeater {
            model: panel.entryWords.map((word, index) => ({ word: word, index: index, field: "entry" }))
                .concat(panel.contextWords.map((word, index) => ({ word: word, index: index, field: "context" })))
            delegate: Rectangle {
                required property var modelData
                readonly property var word: modelData.word
                readonly property bool selected: modelData.field === "entry"
                    ? Selection.contains(modelData.index, panel.entryStart, panel.entryEnd)
                    : Selection.contains(modelData.index, panel.contextStart, panel.contextEnd)
                x: panel.imageX + word.x * panel.scaleX
                y: panel.imageY + word.y * panel.scaleY
                width: word.width * panel.scaleX
                height: word.height * panel.scaleY
                visible: selected
                color: modelData.field === "entry" ? "#7749baf0" : "#77f2aa55"
                border.color: modelData.field === "entry" ? "#a8d9ff" : "#ffd3a1"
                border.width: 1
            }
        }

        Rectangle {
            anchors { left: parent.left; right: parent.right; bottom: parent.bottom; margins: 20 }
            height: controls.implicitHeight + 32
            radius: 12
            color: "#ed151e2a"
            border.color: "#657184"

            ColumnLayout {
                id: controls
                anchors { fill: parent; margins: 16 }
                spacing: 8

                RowLayout {
                    Layout.fillWidth: true
                    Button {
                        text: "Entry"
                        checkable: true
                        checked: panel.activeField === "entry"
                        onClicked: panel.chooseField("entry")
                    }
                    Button {
                        text: "Context"
                        checkable: true
                        checked: panel.activeField === "context"
                        onClicked: panel.chooseField("context")
                    }
                    Button {
                        text: "New region"
                        enabled: !panel.busy
                        onClicked: panel.cropMode = true
                    }
                    Label {
                        Layout.fillWidth: true
                        color: "#c9d6e4"
                        text: panel.busy ? "Recognizing…" : panel.cropMode
                            ? "Drag a region on the screenshot" : "Drag across detected words to refine"
                    }
                    Label {
                        color: "#c9d6e4"
                        text: panel.elapsedMs >= 0 ? "OCR " + panel.elapsedMs + " ms" : ""
                    }
                    Button { text: "Close"; onClicked: Qt.quit() }
                }

                Label { text: "Entry"; color: "#eef3fa" }
                TextArea {
                    id: entryText
                    Layout.fillWidth: true
                    Layout.preferredHeight: 48
                    wrapMode: TextEdit.Wrap
                    placeholderText: "Select a region or type an Entry"
                    color: "#ffffff"
                    selectionColor: "#498bd0"
                    background: Rectangle { color: "#293548"; radius: 5 }
                }
                Label { text: "Context"; color: "#eef3fa" }
                TextArea {
                    id: contextText
                    Layout.fillWidth: true
                    Layout.preferredHeight: 60
                    wrapMode: TextEdit.Wrap
                    placeholderText: "Select a region or type context"
                    color: "#ffffff"
                    selectionColor: "#b97a40"
                    background: Rectangle { color: "#293548"; radius: 5 }
                }
                Label {
                    Layout.fillWidth: true
                    visible: panel.errorMessage !== "" || screenshot.status === Image.Error
                    color: "#ff9e9e"
                    text: screenshot.status === Image.Error ? "Could not load screenshot" : panel.errorMessage
                    wrapMode: Text.Wrap
                }
            }
        }
        }
    }
}
