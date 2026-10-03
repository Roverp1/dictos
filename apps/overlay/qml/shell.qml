pragma ComponentBehavior: Bound

import QtQuick
import Quickshell
import Quickshell.Wayland

ShellRoot {
    id: shell
    readonly property string outputName: Quickshell.env("DICTOS_OCR_OUTPUT") || ""
    Component {
        id: jobFactory
        CommandJob {}
    }
    function command(owner, key, args, payload, revision) {
        var job = jobFactory.createObject(shell, {
            command: ["bun", Quickshell.env("DICTOS_CLI_PATH")].concat(args),
            payload: payload,
            jsonResponse: key !== "model-select"
        });
        job.completed.connect(function (response) {
            owner.commandFinished(key, response, revision);
        });
        job.running = true;
    }
    function ocr(owner, mode, args) {
        var job = jobFactory.createObject(shell, {
            command: ["bun", Quickshell.env("DICTOS_OCR_WARM_CLIENT"), Quickshell.env("DICTOS_OCR_SOCKET"), mode].concat(args)
        });
        job.completed.connect(function (response) {
            owner.ocrFinished(mode, response);
        });
        job.running = true;
    }
    Variants {
        model: Quickshell.screens
        PanelWindow {
            id: panel
            required property var modelData
            screen: modelData
            visible: !shell.outputName || modelData.name === shell.outputName
            anchors {
                top: true
                bottom: true
                left: true
                right: true
            }
            exclusionMode: ExclusionMode.Ignore
            focusable: true
            WlrLayershell.layer: WlrLayer.Overlay
            WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive
            WlrLayershell.namespace: "dictos-overlay-capture"
            CaptureWorkspace {
                id: workspace
                anchors.fill: parent
                autoLoad: panel.visible
                imageUrl: Quickshell.env("DICTOS_OCR_IMAGE_URL") || ""
                fullPsm: Quickshell.env("DICTOS_OCR_FULL_PSM") || "3"
                retryPsm: Quickshell.env("DICTOS_OCR_RETRY_PSM") || "6"
                Component.onCompleted: {
                    if (Quickshell.env("DICTOS_OVERLAY_EXPANDED") === "1")
                        openDrawer(true);
                }
                onCommandRequested: (key, args, payload, revision) => shell.command(workspace, key, args, payload, revision)
                onOcrRequested: (mode, args) => shell.ocr(workspace, mode, args)
                onCopyRequested: text => {
                    Quickshell.clipboardText = text;
                }
                onExitRequested: Qt.quit()
            }
        }
    }
}
