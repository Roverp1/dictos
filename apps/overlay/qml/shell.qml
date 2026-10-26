pragma ComponentBehavior: Bound

import QtQuick
import Quickshell
import Quickshell.Wayland

ShellRoot {
    id: shell
    readonly property string outputName: Quickshell.env("DICTOS_OCR_OUTPUT") || ""
    readonly property var configuration: {
        try {
            var snapshot = JSON.parse(Quickshell.env("DICTOS_OVERLAY_CONFIG_SNAPSHOT"));
            if (snapshot.version !== 1 || snapshot.client !== "overlay" || !snapshot.settings || !(snapshot.settings.defaultModel === null || typeof snapshot.settings.defaultModel === "string"))
                throw new Error("Invalid startup snapshot");
            return snapshot;
        } catch (error) {
            console.error("Overlay startup configuration is missing or invalid.");
            Qt.quit();
            return null;
        }
    }
    CliCommandRunner {
        id: cliRunner
    }
    Component {
        id: jobFactory
        CommandJob {}
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
        model: shell.configuration ? Quickshell.screens : []
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
                initialModel: shell.configuration.settings.defaultModel
                imageUrl: Quickshell.env("DICTOS_OCR_IMAGE_URL") || ""
                fullPsm: Quickshell.env("DICTOS_OCR_FULL_PSM") || "3"
                retryPsm: Quickshell.env("DICTOS_OCR_RETRY_PSM") || "6"
                Component.onCompleted: {
                    if (Quickshell.env("DICTOS_OVERLAY_EXPANDED") === "1")
                        openDrawer(true);
                }
                onCommandRequested: (key, args, payload, revision) => cliRunner.run(workspace, key, args, payload, revision)
                onOcrRequested: (mode, args) => shell.ocr(workspace, mode, args)
                onCopyRequested: text => {
                    Quickshell.clipboardText = text;
                }
                onExitRequested: Qt.quit()
            }
        }
    }
}
