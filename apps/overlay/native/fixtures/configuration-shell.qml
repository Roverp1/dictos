import QtQuick
import Quickshell
import Quickshell.Io
import "production" as Production

ShellRoot {
    id: root
    property bool started: false
    property var results: ({})
    property int childExitCode: -1
    readonly property string folder: Quickshell.env("DICTOS_CONFIGURATION_FIXTURE")
    readonly property bool invalidSnapshot: Quickshell.env("DICTOS_CONFIGURATION_INVALID") === "1"

    Production.CliCommandRunner { id: runner }
    FileView {
        id: captured
        path: root.folder + "/captured.json"
        preload: false
        blockWrites: true
    }
    FileView {
        id: result
        path: root.folder + "/result.json"
        preload: false
        blockWrites: true
    }
    FileView {
        id: gate
        path: root.folder + "/continue"
        watchChanges: true
        onFileChanged: reload()
        onLoaded: {
            if (text().trim() === "run" && !root.started) {
                root.started = true;
                runner.run(root, "models", ["models", "--json"], null, 11);
            }
        }
    }
    Production.CommandJob {
        id: invalidJob
        command: ["bun", Quickshell.env("DICTOS_CLI_PATH"), "overlay", "state", "read", "--json"]
        onCompleted: response => {
            result.setText(JSON.stringify({response: response, exitCode: root.childExitCode}));
            Qt.quit();
        }
    }
    Connections {
        target: invalidJob
        function onExited(exitCode, exitStatus) { root.childExitCode = exitCode; }
    }
    function commandFinished(key, response, revision) {
        results[key] = { response: response, revision: revision };
        if (key === "models") {
            runner.run(root, "state", ["overlay", "state", "read", "--json"], null, 12);
            return;
        }
        result.setText(JSON.stringify(results));
        Qt.quit();
    }
    Component.onCompleted: {
        console.log("CONFIGURATION_FIXTURE_STARTED");
        if (invalidSnapshot) {
            invalidJob.running = true;
            return;
        }
        captured.setText(Quickshell.env("DICTOS_OVERLAY_CONFIG_SNAPSHOT"));
    }
    Timer {
        interval: 20000
        running: true
        onTriggered: Qt.quit()
    }
}
