import QtQuick
import Quickshell

QtObject {
    id: runner
    property Component jobFactory: Component {
        CommandJob {}
    }

    function run(owner, key, args, payload, revision) {
        var job = jobFactory.createObject(runner, {
            command: ["bun", Quickshell.env("DICTOS_CLI_PATH")].concat(args),
            payload: payload
        });
        job.completed.connect(function (response) {
            owner.commandFinished(key, response, revision);
        });
        job.running = true;
    }
}
