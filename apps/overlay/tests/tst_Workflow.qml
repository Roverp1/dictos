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
    Component {
        id: workspaceFactory
        Overlay.CaptureWorkspace { autoLoad: false }
    }
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
            capture.loadingSuggestionRevision = -1;
            capture.selectedModel = "";
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
        function test_new_workspaces_start_from_the_default_and_keep_independent_choices() {
            var first = createTemporaryObject(workspaceFactory, null, { initialModel: "openai/default" });
            var second = createTemporaryObject(workspaceFactory, null, { initialModel: "openai/default" });
            verify(first !== null && second !== null);
            compare(first.selectedModel, "openai/default");
            first.models = [{ id: "google/local" }];
            first.openPicker("model");
            first.choosePopup(0);
            compare(first.selectedModel, "google/local");
            compare(second.selectedModel, "openai/default");
            var reopened = createTemporaryObject(workspaceFactory, null, { initialModel: "openai/default" });
            compare(reopened.selectedModel, "openai/default");
            var absent = createTemporaryObject(workspaceFactory, null, { initialModel: null });
            compare(absent.selectedModel, "");
        }
        function test_each_generation_request_carries_its_current_model() {
            capture.selectedModel = "openai/A";
            capture.updateText("entry", "read", false);
            capture.suggest();
            var suggestion = requests[requests.length - 1];
            compare(suggestion.data.model, "openai/A");
            capture.models = [{ id: "google/B" }];
            capture.openPicker("model");
            capture.choosePopup(0);
            capture.generate(false);
            compare(requests[requests.length - 1].data.model, "google/B");
            compare(suggestion.data.model, "openai/A");
        }
        function test_configuration_failure_notification_shows_source_key_reason_and_preserves_drafts() {
            capture.updateText("entry", "Reviewed Entry", false);
            capture.updateText("description", "Captured Description", false);
            capture.updateText("sense", "Reviewed Sense", false);
            capture.updateText("definition-0", "Manual Description", false);
            capture.save("sense-all");
            capture.commandFinished("save", {
                ok: false,
                error: { code: "CONFIGURATION_ERROR", message: "/tmp/dictos/cli.toml: overrides.logging.level: expected <supported level>" }
            }, 0);
            var notification = findChild(capture, "configuration-notification");
            verify(notification !== null);
            verify(notification.visible);
            verify(notification.text.indexOf("/tmp/dictos/cli.toml") >= 0);
            verify(notification.text.indexOf("overrides.logging.level") >= 0);
            verify(notification.text.indexOf("expected <supported level>") >= 0);
            compare(notification.textFormat, Text.PlainText);
            compare(capture.draft.entry.text, "Reviewed Entry");
            compare(capture.draft.capturedDescription.text, "Captured Description");
            compare(capture.draft.senseName, "Reviewed Sense");
            compare(capture.draft.descriptions[0].text, "Manual Description");
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
            compare(capture.draft.descriptions[0].text, "User definition");
            compare(capture.draft.descriptions[1].text, "A measured value");
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
        function test_model_picker_changes_selection_immediately_without_a_command() {
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
            compare(capture.selectedModel, "openai/A");
            capture.openPicker("model");
            capture.choosePopup(1);
            compare(capture.selectedModel, "openai/B");
            compare(requests.length, 0);
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
        function test_sense_selection_keeps_an_added_manual_description_and_reuses_the_empty_card() {
            capture.selectedModel = "openai/test";
            capture.updateText("entry", "read", false);
            capture.openDrawer(true);
            capture.selectNode("add-definition");
            keyClick(Qt.Key_Return);
            var added = capture.draft.descriptions.find(function (d) {
                return d.type === "definition" && d.key !== "definition-0";
            });
            verify(added !== undefined);
            var key = added.key;
            capture.updateText(key, "Manual added Description", false);
            capture.chooseSense("reading");
            var request = requests[requests.length - 1];
            compare(request.key, "generate");
            compare(capture.draft.descriptions.find(function (d) {
                return d.key === key;
            }).text, "Manual added Description");
            capture.commandFinished("generate", {
                ok: true,
                data: {
                    senseName: "reading",
                    descriptions: [
                        {
                            type: "definition",
                            text: "Generated definition"
                        }
                    ]
                }
            }, request.revision);
            compare(capture.draft.descriptions.length, 5);
            compare(capture.draft.descriptions.find(function (d) {
                return d.key === "definition-0";
            }).text, "Generated definition");
            compare(capture.draft.descriptions.find(function (d) {
                return d.key === key;
            }).text, "Manual added Description");
            verify(findChild(capture, key) !== null);
        }
        function test_pending_generation_stays_invalid_after_entry_edit_and_undo_redo() {
            capture.selectedModel = "openai/test";
            capture.updateText("entry", "read", false);
            capture.generate(false);
            var request = requests[requests.length - 1];
            capture.updateText("entry", "write", false);
            capture.openDrawer(true);
            keyClick(Qt.Key_Z, Qt.ControlModifier);
            keyClick(Qt.Key_R, Qt.ControlModifier);
            compare(capture.draft.entry.text, "write");
            capture.commandFinished("generate", {
                ok: true,
                data: {
                    senseName: "reading",
                    descriptions: [
                        {
                            type: "definition",
                            text: "Output for read"
                        }
                    ]
                }
            }, request.revision);
            compare(capture.draft.senseName, "");
            compare(capture.draft.descriptions[0].text, "");
        }
        function test_changing_model_invalidates_pending_generation_and_suggestions() {
            capture.selectedModel = "openai/A";
            capture.models = [
                {
                    id: "openai/A"
                },
                {
                    id: "openai/B"
                }
            ];
            capture.updateText("entry", "read", false);
            capture.updateText("description", "Captured context", false);
            capture.updateText("translation-0", "Manual translation", false);
            capture.generate(false);
            var generated = requests[requests.length - 1];
            capture.suggest();
            var suggested = requests[requests.length - 1];
            capture.openPicker("model");
            capture.choosePopup(1);
            compare(capture.selectedModel, "openai/B");
            compare(capture.draft.entry.text, "read");
            compare(capture.draft.capturedDescription.text, "Captured context");
            compare(capture.draft.descriptions[1].text, "Manual translation");
            capture.commandFinished("generate", {
                ok: true,
                data: {
                    senseName: "reading",
                    descriptions: [
                        {
                            type: "definition",
                            text: "Model A output"
                        }
                    ]
                }
            }, generated.revision);
            capture.commandFinished("suggest", {
                ok: true,
                data: {
                    senses: [
                        {
                            name: "reading",
                            definition: "Model A preview"
                        }
                    ]
                }
            }, suggested.revision);
            compare(capture.draft.senseName, "");
            compare(capture.draft.descriptions[0].text, "");
            compare(capture.draft.suggestions.length, 0);
            compare(capture.draft.descriptions[1].text, "Manual translation");
        }
        function test_old_suggestions_do_not_finish_the_new_models_pending_request() {
            capture.selectedModel = "openai/A";
            capture.models = [
                {
                    id: "openai/A"
                },
                {
                    id: "openai/B"
                }
            ];
            capture.updateText("entry", "read", false);
            capture.suggest();
            var old = requests[requests.length - 1];
            capture.openPicker("model");
            capture.choosePopup(1);
            capture.suggest();
            var current = requests[requests.length - 1];
            capture.commandFinished("suggest", {
                ok: true,
                data: {
                    senses: [
                        {
                            name: "Old",
                            definition: "Old Model preview"
                        }
                    ]
                }
            }, old.revision);
            compare(capture.suggestionLoading, true);
            compare(capture.draft.suggestions.length, 0);
            capture.commandFinished("suggest", {
                ok: true,
                data: {
                    senses: [
                        {
                            name: "Current",
                            definition: "Current Model preview"
                        }
                    ]
                }
            }, current.revision);
            compare(capture.suggestionLoading, false);
            compare(capture.draft.suggestions[0].name, "Current");
        }
        function test_changing_model_keeps_unused_cached_generation_inactive_on_redo() {
            capture.selectedModel = "openai/A";
            capture.models = [
                {
                    id: "openai/A"
                },
                {
                    id: "openai/B"
                }
            ];
            capture.updateText("entry", "read", false);
            capture.generate(false);
            var request = requests[requests.length - 1];
            capture.openDrawer(true);
            keyClick(Qt.Key_Z, Qt.ControlModifier);
            capture.commandFinished("generate", {
                ok: true,
                data: {
                    senseName: "reading",
                    descriptions: [
                        {
                            type: "definition",
                            text: "Cached Model A output"
                        }
                    ]
                }
            }, request.revision);
            capture.openPicker("model");
            capture.choosePopup(1);
            keyClick(Qt.Key_R, Qt.ControlModifier);
            compare(capture.draft.senseName, "");
            compare(capture.draft.descriptions[0].text, "");
        }
        function test_successful_save_retries_a_failed_preference_write_before_closing() {
            capture.updateText("entry", "read", false);
            capture.updateText("instruction", "Remember this exact Instruction", false);
            capture.flushState();
            capture.commandFinished("state-write", {
                ok: false,
                error: {
                    message: "Write failed"
                }
            }, 0);
            capture.save("entry");
            capture.commandFinished("save", {
                ok: true,
                data: {
                    entryId: "entry",
                    senseId: null,
                    capturedDescriptionId: null,
                    descriptionIds: []
                }
            }, 0);
            compare(capture.savedAlready, true);
            compare(exitSpy.count, 0);
            compare(requests[requests.length - 1].key, "state-write");
            compare(requests[requests.length - 1].data.instructionText, "Remember this exact Instruction");
            capture.commandFinished("state-write", {
                ok: true,
                data: {}
            }, 0);
            compare(exitSpy.count, 1);
            compare(requests.filter(function (r) {
                return r.key === "save";
            }).length, 1);
        }
        function test_description_wheel_reverses_promptly_data() {
            return [
                {
                    tag: "short list at its bounds",
                    extraCards: 0
                },
                {
                    tag: "long list in its middle",
                    extraCards: 4
                },
                {
                    tag: "rapid burst over Description bodies",
                    extraCards: 12,
                    burst: 6,
                    overBody: true
                }
            ];
        }
        function descriptionWheelPoint(scroll) {
            for (var card of capture.draft.descriptions) {
                var field = findChild(capture, card.key);
                var view = findChild(field, "capture-scroll");
                var point = view.mapToItem(scroll, view.width / 2, view.height / 2);
                if (point.y > 0 && point.y < scroll.height)
                    return point;
            }
            fail("No visible Description body for wheel input");
        }
        function test_description_wheel_reverses_promptly(data) {
            var next = State.copy(capture.draft);
            next.descriptions.forEach(function (card) {
                card.text = "A long Description.\n".repeat(20);
            });
            for (var i = 0; i < data.extraCards; i++)
                next.descriptions.push({
                    key: "scroll-" + i,
                    type: "definition",
                    text: "Description " + i,
                    edited: true
                });
            capture.draft = next;
            capture.openDrawer(true);
            wait(550);
            var scroll = findChild(capture, "results-scroll");
            verify(scroll !== null);
            var limit = scroll.contentHeight - scroll.height;
            verify(limit > 20);
            scroll.contentY = data.extraCards ? 400 : 0;
            var start = scroll.contentY;
            for (var step = 0; step < (data.burst || 1); step++) {
                var point = data.overBody ? descriptionWheelPoint(scroll) : Qt.point(2, 150);
                mouseWheel(scroll, point.x, point.y, 0, -120, Qt.NoButton, Qt.NoModifier, 0);
                if (data.burst)
                    wait(10);
            }
            wait(40);
            verify(scroll.contentY > start, "Downward wheel input must move the Description list: start=" + start + ", after=" + scroll.contentY);
            var down = Math.min(limit, scroll.contentY);
            var body = descriptionWheelPoint(scroll);
            mouseWheel(scroll, body.x, body.y, 0, 120, Qt.NoButton, Qt.NoModifier, 0);
            wait(60);
            verify(scroll.contentY < down, "Upward wheel reversal must take effect promptly: before=" + down + ", after=" + scroll.contentY);
            var up = scroll.contentY;
            body = descriptionWheelPoint(scroll);
            mouseWheel(scroll, body.x, body.y, 0, -120, Qt.NoButton, Qt.NoModifier, 0);
            wait(60);
            verify(scroll.contentY > up, "Downward wheel reversal must take effect promptly: before=" + up + ", after=" + scroll.contentY);
        }
        function test_description_editor_keeps_its_own_wheel_scrolling_in_edit_mode() {
            capture.updateText("definition-0", "A long Description.\n".repeat(30), false);
            capture.openDrawer(true);
            wait(550);
            capture.edit("definition-0");
            var field = findChild(capture, "definition-0");
            var view = findChild(field, "capture-scroll");
            var outer = findChild(capture, "results-scroll");
            field.editor.cursorPosition = 0;
            view.contentItem.contentY = 0;
            wait(40);
            var outerBefore = outer.contentY;
            mouseWheel(view, view.width / 2, view.height / 2, 0, -120, Qt.NoButton, Qt.NoModifier, 0);
            wait(60);
            verify(view.contentItem.contentY > 0, "Editing must still allow scrolling through long Description text");
            compare(outer.contentY, outerBefore);
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
