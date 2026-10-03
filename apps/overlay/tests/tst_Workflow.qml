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
    SignalSpy {
        id: exitSpy
        target: capture
        signalName: "exitRequested"
    }
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
            capture.retryWords = [];
            capture.usingRetry = false;
            capture.selecting = false;
            capture.cropping = false;
            capture.generationLoading = false;
            capture.suggestionLoading = false;
            capture.pendingModel = "";
            capture.modelTouched = false;
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
            exitSpy.clear();
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
        function test_equal_columns_grow_only_from_center_content() {
            capture.openDrawer(true);
            var next = State.copy(capture.draft);
            next.suggestions = [
                {
                    name: "Квітковий інтерфейс",
                    definition: "Програмний інтерфейс для швидкого передавання даних між об'єктами. Використовується для побудови гнучких графічних застосунків і зручної взаємодії з користувачем."
                }
            ];
            capture.draft = next;
            wait(550);
            var drawer = findChild(capture, "capture-drawer");
            var center = findChild(capture, "config-column");
            compare(findChild(capture, "senses-column").width, center.width);
            compare(findChild(capture, "results-column").width, center.width);
            var height = drawer.height;
            capture.updateText("instruction", "A long Instruction.\n".repeat(12), false);
            wait(50);
            verify(drawer.height > height);
            height = drawer.height;
            capture.updateText("definition-0", "A long definition.\n".repeat(30), false);
            wait(50);
            compare(drawer.height, height);
            compare(findChild(capture, "suggestion-0").contentItem.truncated, false);
        }
        function test_single_click_selects_a_whole_word_for_each_field() {
            capture.fullWords = [
                {
                    text: "read",
                    x: 110,
                    y: 92,
                    width: 60,
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
            mouseClick(capture, 140, 105, Qt.LeftButton);
            compare(capture.draft.entry.text, "read");
            verify(capture.draft.entry.selection !== null);
            mouseClick(capture, 250, 105, Qt.RightButton);
            compare(capture.draft.capturedDescription.text, "book.");
            compare(capture.draft.entry.text, "read");
            mouseDoubleClickSequence(capture, 250, 105, Qt.LeftButton);
            compare(capture.draft.entry.text, "read");
            compare(capture.draft.entry.selection, null);
            verify(capture.draft.capturedDescription.selection !== null);
            mouseDoubleClickSequence(capture, 140, 105, Qt.RightButton);
            compare(capture.draft.capturedDescription.text, "book.");
            compare(capture.draft.capturedDescription.selection, null);
        }
        function test_keyboard_navigation_survives_adding_a_description_and_reopening() {
            capture.openDrawer(true);
            wait(550);
            capture.selectNode("add-definition");
            keyClick(Qt.Key_Return);
            compare(capture.draft.descriptions.length, 5);
            wait(20);
            var add = findChild(capture, "add-definition");
            var save = findChild(capture, "save-sense");
            verify(add.mapToItem(capture, 0, 0).y + add.height <= save.mapToItem(capture, 0, 0).y);
            keyClick(Qt.Key_H, Qt.ControlModifier);
            verify(capture.activeNodeId !== "add-definition");
            keyClick(Qt.Key_J, Qt.ControlModifier);
            keyClick(Qt.Key_K, Qt.ControlModifier);
            keyClick(Qt.Key_L, Qt.ControlModifier);
            verify(capture.activeNodeId !== "entry");
            keyClick(Qt.Key_I);
            var field = findChild(capture, capture.activeNodeId);
            verify(field !== null);
            tryCompare(field.editor, "activeFocus", true);
        }
        function test_only_crop_results_outline_recognized_words() {
            var words = [
                {
                    text: "read",
                    x: 110,
                    y: 92,
                    width: 60,
                    height: 30,
                    symbols: []
                }
            ];
            capture.ocrFinished("full", {
                ok: true,
                data: {
                    words: words
                }
            });
            verify(findChild(capture, "recognized-word-0") === null);
            capture.ocrFinished("crop", {
                ok: true,
                data: {
                    words: words
                }
            });
            tryVerify(function () {
                return findChild(capture, "recognized-word-0") !== null;
            });
            var guide = findChild(capture, "recognized-word-0");
            compare(guide.border.width, 1);
            verify(guide.border.color.a > 0 && guide.border.color.a < 0.75);
            var toggle = findChild(capture, "ocr-view-toggle");
            mouseClick(toggle);
            compare(capture.usingRetry, false);
            tryVerify(function () {
                return findChild(capture, "recognized-word-0") === null;
            });
        }
        function test_crop_reply_during_a_drag_keeps_the_original_word_source() {
            capture.usingRetry = false;
            capture.fullWords = [
                {
                    text: "another",
                    x: 10,
                    y: 92,
                    width: 60,
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
                }
            ];
            wait(550);
            mousePress(capture, 120, 105, Qt.LeftButton);
            mouseMove(capture, 155, 105);
            capture.ocrFinished("crop", {
                ok: true,
                data: {
                    words: [
                        {
                            text: "different",
                            x: 400,
                            y: 300,
                            width: 60,
                            height: 30,
                            symbols: []
                        }
                    ]
                }
            });
            mouseRelease(capture, 155, 105, Qt.LeftButton);
            compare(capture.draft.entry.text, "read");
            compare(capture.selecting, false);
        }
        function test_empty_crop_preserves_the_last_selectable_ocr_result() {
            capture.ocrFinished("full", {
                ok: true,
                data: {
                    words: [
                        {
                            text: "read",
                            x: 110,
                            y: 92,
                            width: 60,
                            height: 30,
                            symbols: []
                        }
                    ]
                }
            });
            capture.ocrFinished("crop", {
                ok: true,
                data: {
                    words: []
                }
            });
            compare(capture.usingRetry, false);
            compare(capture.words[0].text, "read");
            verify(capture.notification.length > 0);
        }
        function test_clicking_a_drawer_divider_pins_without_selecting_screen_text() {
            capture.updateText("entry", "Original Entry", false);
            capture.openDrawer(false);
            wait(550);
            var center = findChild(capture, "config-column");
            var point = center.mapToItem(capture, center.width + 16, 12);
            capture.fullWords = [
                {
                    text: "Accidental",
                    x: point.x - 5,
                    y: point.y - 5,
                    width: 30,
                    height: 30,
                    symbols: []
                }
            ];
            mouseClick(capture, point.x, point.y);
            compare(capture.drawerMode, "pinned");
            compare(capture.draft.entry.text, "Original Entry");
        }
        function test_generate_can_replace_filled_types_and_restore_them_with_undo() {
            capture.selectedModel = "openai/test";
            capture.updateText("entry", "read", false);
            capture.updateText("sense", "reading", false);
            capture.updateText("definition-0", "My manual definition", false);
            capture.updateText("translation-0", "Keep translation", false);
            capture.openDrawer(true);
            verify(capture.canGenerate);
            capture.selectNode("generate");
            keyClick(Qt.Key_Return);
            var request = requests[requests.length - 1];
            compare(request.key, "generate");
            compare(request.data.descriptions[0].text, "My manual definition");
            compare(capture.draft.descriptions[0].text, "");
            capture.commandFinished("generate", {
                ok: true,
                data: {
                    senseName: "reading",
                    descriptions: [
                        {
                            type: "definition",
                            text: "New definition"
                        }
                    ]
                }
            }, request.revision);
            compare(capture.draft.descriptions[0].text, "New definition");
            compare(capture.draft.descriptions[1].text, "Keep translation");
            keyClick(Qt.Key_Z, Qt.ControlModifier);
            compare(capture.draft.descriptions[0].text, "My manual definition");
        }
        function test_malformed_save_success_does_not_discard_the_draft() {
            capture.updateText("entry", "Reviewed Entry", false);
            var replies = [
                {
                    ok: true
                },
                {
                    ok: "false",
                    data: {
                        entryId: "entry",
                        senseId: null,
                        capturedDescriptionId: null,
                        descriptionIds: []
                    }
                },
                {
                    ok: true,
                    data: {
                        entryId: "entry",
                        senseId: null,
                        capturedDescriptionId: null,
                        descriptionIds: "bad"
                    }
                }
            ];
            for (var response of replies) {
                capture.savedAlready = false;
                capture.closing = false;
                capture.save("entry");
                capture.commandFinished("save", response, 0);
                compare(capture.savedAlready, false);
                compare(capture.closing, false);
                compare(capture.draft.entry.text, "Reviewed Entry");
                verify(capture.notification.length > 0);
            }
        }
        function test_model_selection_is_serialized_and_late_startup_data_is_ignored() {
            capture.models = [
                {
                    id: "openai/A"
                },
                {
                    id: "openai/B"
                }
            ];
            capture.openPicker("model");
            capture.choosePopup(0);
            capture.openPicker("model");
            capture.choosePopup(1);
            compare(requests.filter(function (r) {
                return r.key === "model-select";
            }).length, 1);
            capture.commandFinished("model-select", {
                ok: true,
                data: null
            }, 0);
            compare(capture.selectedModel, "openai/A");
            capture.commandFinished("model", {
                ok: true,
                data: {
                    id: "old choice"
                }
            }, 0);
            compare(capture.selectedModel, "openai/A");
        }
        function test_confirmed_save_receipt_closes_only_after_success() {
            capture.updateText("entry", "Reviewed Entry", false);
            capture.updateText("description", "Captured text", false);
            capture.save("entry");
            compare(exitSpy.count, 0);
            capture.commandFinished("save", {
                ok: true,
                data: {
                    entryId: "entry",
                    senseId: null,
                    capturedDescriptionId: "captured",
                    descriptionIds: []
                }
            }, 0);
            compare(capture.savedAlready, true);
            compare(exitSpy.count, 1);
        }
        function test_save_all_rejects_a_receipt_reusing_the_captured_description_id() {
            capture.updateText("entry", "Reviewed Entry", false);
            capture.updateText("description", "Captured text", false);
            capture.updateText("sense", "Sense", false);
            capture.updateText("definition-0", "Definition", false);
            capture.save("sense-all");
            capture.commandFinished("save", {
                ok: true,
                data: {
                    entryId: "entry",
                    senseId: "sense",
                    capturedDescriptionId: "same-id",
                    descriptionIds: ["same-id"]
                }
            }, 0);
            compare(capture.savedAlready, false);
            compare(exitSpy.count, 0);
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
