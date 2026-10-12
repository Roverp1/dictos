import QtQuick
import Quickshell.Io

Process {
    id: job
    property var payload: null
    property bool jsonResponse: true
    signal completed(var response)
    stdinEnabled: payload !== null
    stdout: StdioCollector {
        id: output
    }
    stderr: StdioCollector {
        id: errors
    }
    onStarted: {
        if (payload !== null)
            write(JSON.stringify(payload) + "\n");
    }
    onExited: (exitCode, exitStatus) => Qt.callLater(function () {
            var response;
            try {
                response = jsonResponse ? JSON.parse(output.text.trim()) : {
                    ok: exitCode === 0,
                    data: null
                };
                if (response.error && typeof response.error === "string")
                    response = {
                        ok: false,
                        error: {
                            message: response.error
                        }
                    };
                if (response.ok === undefined && Array.isArray(response.words))
                    response = {
                        ok: true,
                        data: response
                    };
                if (typeof response.ok !== "boolean" || (response.ok && !("data" in response)) || (exitCode !== 0 && response.ok))
                    throw new Error("Invalid command outcome");
            } catch (error) {
                response = {
                    ok: false,
                    error: {
                        message: "Command returned no usable result. Its outcome is unknown."
                    }
                };
            }
            completed(response);
            destroy();
        })
}
