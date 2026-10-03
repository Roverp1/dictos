import QtQuick
import QtTest
import "../qml" as Overlay
import "../qml/state.js" as State

Item {
    width: 1400
    height: 900
    Overlay.CaptureWorkspace {
        id: capture
        width: parent.width
        height: parent.height
        autoLoad: false
        imageUrl: Qt.resolvedUrl("fixture.png")
    }
    property var requests: []
    Connections {
        target: capture
        function onCommandRequested(key, args, data, revision) {
            requests.push({
                key: key,
                data: data,
                revision: revision
            });
        }
    }
    TestCase {
        name: "CaptureWorkflow"
        when: windowShown
        function init() {
            capture.draft = State.newOverlayState();
            capture.fullWords = [];
            capture.activeField = "entry";
            capture.notification = "";
            capture.saving = false;
            capture.savedAlready = false;
            capture.stateDirty = false;
            capture.stateTouched = false;
            capture.stateWritePending = false;
            capture.stateWriteFailed = false;
            capture.closing = false;
            requests = [];
            capture.closeDrawer();
        }
        function test_drawer_starts_navigation_on_the_compact_field() {
            capture.activeField = "description";
            capture.openDrawer(true);
            compare(capture.mode, "navigation");
            compare(capture.activeNodeId, "description");
            keyClick(Qt.Key_I);
            compare(capture.mode, "editing");
            var field = findChild(capture, "description");
            verify(field !== null);
            tryCompare(field.editor, "activeFocus", true);
            keyClick("h");
            keyClick("j");
            compare(capture.draft.capturedDescription.text.slice(-2), "hj");
            keyClick(Qt.Key_Escape);
            compare(capture.mode, "navigation");
            keyClick(Qt.Key_K);
            compare(capture.activeNodeId, "entry");
        }
        function test_failed_save_preserves_right_drafts_and_copy_labels() {
            capture.updateText("entry", "read", false);
            capture.updateText("sense", "reading", false);
            capture.updateText("definition-0", "Edited definition", false);
            capture.save("entry");
            compare(requests[requests.length - 1].data.kind, "entry");
            verify(requests[requests.length - 1].data.descriptions === undefined);
            capture.commandFinished("save", {
                ok: false,
                error: {
                    message: "Database unavailable"
                }
            }, 0);
            compare(capture.draft.descriptions[0].text, "Edited definition");
            compare(capture.savedAlready, false);
            verify(capture.notification.indexOf("Database unavailable") >= 0);
        }
        function test_right_field_does_not_lose_focus_on_every_character() {
            capture.openDrawer(true);
            capture.selectNode("definition-0");
            keyClick(Qt.Key_I);
            var field = findChild(capture, "definition-0");
            tryCompare(field.editor, "activeFocus", true);
            field.editor.selectAll();
            keyClick("a");
            keyClick("b");
            keyClick("c");
            compare(capture.draft.descriptions[0].text, "abc");
            verify(field.editor.activeFocus);
            keyClick(Qt.Key_Escape);
        }
        function test_suggestion_starts_generation_and_late_result_is_redoable() {
            capture.selectedModel = "openai/test";
            capture.updateText("entry", "read", false);
            capture.updateText("sense", "old Sense", false);
            capture.updateText("definition-0", "User definition", false);
            capture.chooseSense("measurement");
            var request = requests[requests.length - 1];
            compare(request.key, "generate");
            compare(request.data.senseName, "measurement");
            capture.openDrawer(true);
            keyClick(Qt.Key_Z, Qt.ControlModifier);
            capture.commandFinished("generate", {
                ok: true,
                data: {
                    senseName: "measurement",
                    descriptions: [
                        {
                            type: "definition",
                            text: "A measured value"
                        }
                    ]
                }
            }, request.revision);
            compare(capture.draft.senseName, "old Sense");
            compare(capture.draft.descriptions[0].text, "User definition");
            keyClick(Qt.Key_R, Qt.ControlModifier);
            compare(capture.draft.senseName, "measurement");
            compare(capture.draft.descriptions[0].text, "A measured value");
            compare(requests.filter(function (r) {
                return r.key === "generate";
            }).length, 1);
        }
        function test_late_state_read_does_not_replace_an_edited_instruction() {
            capture.updateText("instruction", "My edited instruction", false);
            capture.flushState();
            capture.commandFinished("state-read", {
                ok: true,
                data: {
                    version: 1,
                    instructionText: "old text",
                    selectedTypes: ["definition"]
                }
            }, 0);
            compare(capture.draft.instructionText, "My edited instruction");
            capture.commandFinished("state-write", {
                ok: true,
                data: {}
            }, 0);
        }
        function test_older_generation_does_not_clear_the_pending_newer_request() {
            capture.selectedModel = "openai/test";
            capture.updateText("entry", "read", false);
            capture.chooseSense("first Sense");
            var old = requests[requests.length - 1];
            capture.chooseSense("second Sense");
            capture.commandFinished("generate", {
                ok: true,
                data: {
                    senseName: "first Sense",
                    descriptions: [
                        {
                            type: "definition",
                            text: "Old"
                        }
                    ]
                }
            }, old.revision);
            compare(capture.generationLoading, true);
            compare(capture.draft.senseName, "second Sense");
        }
        function test_popup_pointer_and_keyboard_choose_the_same_instruction() {
            capture.instructions = [
                {
                    name: "First",
                    text: "First instruction"
                },
                {
                    name: "Second",
                    text: "Second instruction"
                }
            ];
            capture.openPicker("instruction");
            wait(550);
            var popup = findChild(capture, "instruction-picker");
            var point = popup.mapToItem(capture, 40, 90);
            mouseMove(capture, 1, 1);
            mouseMove(capture, point.x, point.y);
            tryCompare(capture, "popupIndex", 1);
            keyClick(Qt.Key_Return);
            compare(capture.draft.instructionText, "Second instruction");
            compare(capture.instructions[1].text, "Second instruction");
        }
        function test_independent_drag_selections_and_double_click_only_clear_geometry() {
            capture.fullWords = [
                {
                    text: "I",
                    x: 80,
                    y: 92,
                    width: 15,
                    height: 30,
                    symbols: []
                },
                {
                    text: "read",
                    x: 110,
                    y: 92,
                    width: 60,
                    height: 30,
                    symbols: []
                },
                {
                    text: "a",
                    x: 185,
                    y: 92,
                    width: 16,
                    height: 30,
                    symbols: []
                },
                {
                    text: "book.",
                    x: 218,
                    y: 92,
                    width: 78,
                    height: 30,
                    symbols: []
                }
            ];
            wait(550);
            mousePress(capture, 115, 105, Qt.LeftButton);
            mouseMove(capture, 150, 105);
            mouseRelease(capture, 150, 105, Qt.LeftButton);
            compare(capture.draft.entry.text, "read");
            mousePress(capture, 82, 105, Qt.RightButton);
            compare(capture.activeField, "description");
            verify(capture.selecting);
            mouseMove(capture, 270, 105);
            verify(capture.dragRange !== null);
            mouseRelease(capture, 270, 105, Qt.RightButton);
            compare(capture.draft.capturedDescription.text, "I read a book.");
            compare(capture.draft.entry.text, "read");
            verify(capture.draft.entry.selection !== null);
            mouseDoubleClickSequence(capture, 225, 105, Qt.LeftButton);
            compare(capture.draft.entry.text, "read");
            compare(capture.draft.entry.selection, null);
            verify(capture.draft.capturedDescription.selection !== null);
        }
    }
}
