pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls
import "components"
import "selection.js" as Selection
import "state.js" as State
import "navigation.js" as Navigation

Item {
    id: workspace
    property string imageUrl: ""
    property string fullPsm: "3"
    property string retryPsm: "6"
    property bool autoLoad: true
    property var draft: State.newOverlayState()
    property var fullWords: []
    property var retryWords: []
    property bool usingRetry: false
    readonly property var words: usingRetry ? retryWords : fullWords
    property string activeField: "entry"
    property string activeNodeId: "entry"
    property string editingNodeId: ""
    property string mode: "compact-edit"
    property string drawerMode: "compact"
    readonly property bool expanded: drawerMode !== "compact"
    property bool hoverSuppressed: false
    property bool selecting: false
    property bool cropping: false
    property var dragAnchor: null
    property var dragFocus: null
    property var pressLocal: null
    property string pressedBeforeText: ""
    property var completedClick: null
    property bool suppressRelease: false
    property var dragRange: null
    property var dragWords: []
    property bool precise: false
    property var nodes: []
    property string popupKind: ""
    property int popupIndex: 0
    property var instructions: []
    property var models: []
    property var initialModel: null
    property string selectedModel: ""
    onSelectedModelChanged: {
        draft = State.modelChanged(draft);
        generationLoading = false;
        suggestionLoading = false;
        loadingGenerationRevision = -1;
        loadingSuggestionRevision = -1;
    }
    property string notification: ""
    property bool ocrLoading: true
    property bool generationLoading: false
    property int loadingGenerationRevision: -1
    property bool suggestionLoading: false
    property int loadingSuggestionRevision: -1
    property bool saving: false
    property var pendingSave: null
    property bool savedAlready: false
    property bool stateDirty: false
    property bool stateTouched: false
    property bool stateWriteFailed: false
    property bool stateWritePending: false
    property bool closing: false
    readonly property bool canGenerate: !!draft.entry.text.trim() && !!selectedModel && draft.selectedTypes.length > 0
    readonly property bool canSaveSense: !!draft.entry.text.trim() && !!draft.senseName.trim() && draft.descriptions.some(function (d) {
        return !!d.text.trim();
    })
    signal commandRequested(string key, var arguments, var payload, int revision)
    signal ocrRequested(string mode, var arguments)
    signal copyRequested(string text)
    signal exitRequested
    focus: true

    function registerNode(id, section, item, action, editAction, clearAction) {
        nodes = nodes.filter(function (n) {
            return n.id !== id;
        }).concat([
            {
                id: id,
                section: section,
                item: item,
                action: action,
                editAction: editAction,
                clearAction: clearAction
            }
        ]);
    }
    function unregisterNode(id, owner) {
        nodes = nodes.filter(function (n) {
            return n.id !== id || (owner && n.item !== owner);
        });
    }
    function nodeGeometry() {
        return nodes.map(function (n) {
            var p = n.item.mapToItem(workspace, 0, 0);
            return {
                id: n.id,
                section: n.section,
                x: p.x,
                y: p.y,
                width: n.item.width,
                height: n.item.height,
                enabled: n.item.enabled && (n.section !== "senses" || drawer.senseWidth > 0)
            };
        });
    }
    function selectNode(id) {
        if (!id)
            return;
        activeNodeId = id;
        var node = nodes.find(function (n) {
            return n.id === id;
        });
        if (!node)
            return;
        var parent = node.item.parent;
        while (parent && parent !== workspace) {
            if (parent.contentY !== undefined && parent.contentHeight !== undefined) {
                var pos = node.item.mapToItem(parent.contentItem, 0, 0).y;
                if (pos < parent.contentY)
                    parent.contentY = Math.max(0, pos);
                else if (pos + node.item.height > parent.contentY + parent.height)
                    parent.contentY = Math.min(Math.max(0, parent.contentHeight - parent.height), pos + node.item.height - parent.height);
                break;
            }
            parent = parent.parent;
        }
    }
    function openDrawer(pin) {
        if (saving)
            return;
        if (!expanded)
            selectNode(activeField);
        drawerMode = pin ? "pinned" : "hover";
        mode = "navigation";
        editingNodeId = "";
        keys.forceActiveFocus();
    }
    function closeDrawer() {
        if (saving)
            return;
        popupKind = "";
        drawerMode = "compact";
        editingNodeId = "";
        mode = "compact-edit";
        hoverSuppressed = true;
        Qt.callLater(function () {
            if (expanded || mode !== "compact-edit")
                return;
            if (activeField === "entry")
                compactEntry.editor.forceActiveFocus();
            else
                compactDescription.editor.forceActiveFocus();
        });
    }
    function updateText(field, text, remember) {
        if (saving || savedAlready)
            return;
        draft = State.changeText(draft, field, text, remember);
        if (field === "instruction") {
            stateTouched = true;
            stateDirty = true;
            stateTimer.restart();
        }
    }
    function edit(id) {
        drawerMode = "pinned";
        selectNode(id);
        editingNodeId = id;
        mode = "editing";
    }
    function clear(id) {
        updateText(id, "", true);
    }
    function activate() {
        if (popupKind) {
            choosePopup(popupIndex);
            return;
        }
        var node = nodes.find(function (n) {
            return n.id === activeNodeId;
        });
        if (node && node.item.enabled) {
            drawerMode = "pinned";
            node.action();
        }
    }
    function back() {
        if (popupKind) {
            popupKind = "";
            mode = "navigation";
            keys.forceActiveFocus();
            return;
        }
        if (mode === "editing") {
            mode = "navigation";
            editingNodeId = "";
            keys.forceActiveFocus();
            return;
        }
        if (expanded)
            closeDrawer();
        else
            requestExit();
    }
    function localState() {
        return {
            version: 1,
            instructionText: draft.instructionText,
            selectedTypes: draft.selectedTypes
        };
    }
    function flushState() {
        if (stateWritePending)
            return;
        if (!stateDirty) {
            if (closing)
                exitRequested();
            return;
        }
        stateDirty = false;
        stateWritePending = true;
        commandRequested("state-write", ["overlay", "state", "write", "--json"], localState(), 0);
    }
    function requestExit(explicit) {
        if (stateWriteFailed && explicit !== false) {
            console.warn("Overlay-local state could not be saved before explicit exit.");
            exitRequested();
            return;
        }
        closing = true;
        stateTimer.stop();
        flushState();
    }
    function toggleType(type) {
        var next = State.copy(draft);
        next.selectedTypes = next.selectedTypes.includes(type) ? next.selectedTypes.filter(function (t) {
            return t !== type;
        }) : next.selectedTypes.concat([type]);
        next.generationRevision++;
        next.activeGenerationActionRevision = null;
        draft = next;
        stateTouched = true;
        stateDirty = true;
        stateTimer.restart();
    }
    function generate(alreadyStarted) {
        if (!canGenerate || saving)
            return;
        drawerMode = "pinned";
        var contextDescriptions = draft.descriptions.filter(function (d) {
            return d.text.trim();
        }).map(function (d) {
            return {
                type: d.type,
                text: d.text
            };
        });
        if (!alreadyStarted)
            draft = State.beginGeneration(draft);
        generationLoading = true;
        loadingGenerationRevision = draft.activeGenerationActionRevision;
        commandRequested("generate", ["overlay", "generate", "--json"], {
            entryText: draft.entry.text,
            descriptionText: draft.capturedDescription.text || null,
            instructionText: draft.instructionText,
            model: selectedModel,
            senseName: draft.senseName || null,
            descriptions: contextDescriptions,
            targetTypes: draft.selectedTypes
        }, draft.activeGenerationActionRevision);
    }
    function suggest() {
        if (!draft.entry.text.trim() || !selectedModel || saving)
            return;
        drawerMode = "pinned";
        suggestionLoading = true;
        loadingSuggestionRevision = draft.generationRevision;
        commandRequested("suggest", ["overlay", "suggest", "--json"], {
            entryText: draft.entry.text,
            descriptionText: draft.capturedDescription.text || null,
            instructionText: draft.instructionText,
            model: selectedModel
        }, draft.generationRevision);
    }
    function chooseSense(name) {
        if (saving)
            return;
        draft = State.chooseSense(draft, name);
        generate(true);
    }
    function save(kind) {
        if (saving || savedAlready)
            return;
        drawerMode = "pinned";
        mode = "navigation";
        editingNodeId = "";
        saving = true;
        notification = "";
        pendingSave = State.savePayload(draft, kind);
        commandRequested("save", ["overlay", "save", "--json"], pendingSave, 0);
    }
    function openPicker(kind) {
        popupKind = kind;
        popupIndex = 0;
        mode = "popup";
        drawerMode = "pinned";
        keys.forceActiveFocus();
    }
    function choosePopup(index) {
        if (!popupKind)
            return;
        var items = popupKind === "instruction" ? instructions : models;
        var selected = items[index];
        if (!selected)
            return;
        if (popupKind === "instruction")
            updateText("instruction", selected.text, true);
        else
            selectedModel = selected.id;
        popupKind = "";
        mode = "navigation";
        keys.forceActiveFocus();
    }
    function error(key, response) {
        notification = key + ": " + (response.error?.message || "Operation failed. Your draft is still here.");
        if (!expanded)
            openDrawer(true);
    }
    function commandFinished(key, response, revision) {
        if (key === "state-write") {
            stateWritePending = false;
            if (!response.ok) {
                stateWriteFailed = true;
                closing = false;
                stateDirty = true;
                error(key, response);
                return;
            }
            stateWriteFailed = false;
            if (closing || stateDirty)
                flushState();
            return;
        }
        if (key === "save") {
            saving = false;
            if (response.ok === true && State.validSaveReceipt(response.data, pendingSave)) {
                savedAlready = true;
                requestExit(false);
            } else if (response.ok === false)
                error(key, response);
            else
                error(key, {
                    error: {
                        message: "Save returned no valid receipt. Its outcome is unknown; your draft is still here."
                    }
                });
            return;
        }
        if (key === "generate") {
            if (revision === loadingGenerationRevision)
                generationLoading = false;
            if (response.ok)
                draft = State.receiveGeneration(draft, revision, response.data);
            else if (draft.activeGenerationActionRevision === revision)
                error(key, response);
            return;
        }
        if (key === "suggest") {
            if (revision === loadingSuggestionRevision)
                suggestionLoading = false;
            if (revision !== draft.generationRevision)
                return;
            if (response.ok) {
                var next = State.copy(draft);
                next.suggestions = response.data.senses;
                draft = next;
            } else
                error(key, response);
            return;
        }
        if (!response.ok) {
            error(key, response);
            return;
        }
        if (key === "instructions")
            instructions = response.data;
        else if (key === "models")
            models = response.data;
        else if (key === "state-read" && !stateTouched) {
            var nextState = State.copy(draft);
            nextState.instructionText = response.data.instructionText;
            nextState.selectedTypes = response.data.selectedTypes;
            draft = nextState;
        }
    }
    function ocrFinished(kind, response) {
        ocrLoading = false;
        if (!response.ok) {
            error("OCR", response);
            return;
        }
        if (kind === "crop" && response.data.words.length === 0) {
            error("OCR", {
                error: {
                    message: "No text recognized in this crop. The previous OCR result is still available."
                }
            });
            return;
        }
        if (kind === "full")
            fullWords = response.data.words;
        else {
            retryWords = response.data.words;
            usingRetry = true;
        }
    }
    function pixelAt(x, y) {
        if (image.status !== Image.Ready || !image.paintedWidth || !image.paintedHeight)
            return null;
        var left = (image.width - image.paintedWidth) / 2, top = (image.height - image.paintedHeight) / 2;
        if (x < left || y < top || x >= left + image.paintedWidth || y >= top + image.paintedHeight)
            return null;
        return {
            x: (x - left) * image.sourceSize.width / image.paintedWidth,
            y: (y - top) * image.sourceSize.height / image.paintedHeight
        };
    }
    function screenX(x) {
        return (image.width - image.paintedWidth) / 2 + x * image.paintedWidth / image.sourceSize.width;
    }
    function screenY(y) {
        return (image.height - image.paintedHeight) / 2 + y * image.paintedHeight / image.sourceSize.height;
    }
    function setSelection(range, source) {
        if (!range)
            return;
        updateText(activeField, Selection.textForSelection(source, range), false);
        var next = State.copy(draft), field = activeField === "entry" ? next.entry : next.capturedDescription;
        field.selection = range;
        field.sourceWords = source;
        field.edited = false;
        draft = next;
    }
    function clearHighlight(fieldName) {
        var next = State.copy(draft);
        var field = fieldName === "entry" ? next.entry : next.capturedDescription;
        field.selection = null;
        field.sourceWords = [];
        draft = next;
    }
    function copyDrafts() {
        var text = "Entry:\n" + draft.entry.text + "\n\nDescription:\n" + draft.capturedDescription.text + "\n\nInstruction:\n" + draft.instructionText + "\n\nSense:\n" + draft.senseName;
        draft.descriptions.forEach(function (d) {
            if (d.text.trim())
                text += "\n\n" + d.type + ":\n" + d.text;
        });
        copyRequested(text);
    }

    Timer {
        id: stateTimer
        interval: 350
        onTriggered: workspace.flushState()
    }
    Component.onCompleted: {
        selectedModel = initialModel || "";
        if (!autoLoad)
            return;
        commandRequested("state-read", ["overlay", "state", "read", "--json"], null, 0);
        commandRequested("instructions", ["instruction", "list", "--json"], null, 0);
        commandRequested("models", ["models", "--json"], null, 0);
    }
    PanelKeyCatcher {
        id: keys
        mode: workspace.mode
        onMove: (dx, dy) => {
            if (workspace.popupKind) {
                workspace.popupIndex = Math.max(0, Math.min(popupList.count - 1, workspace.popupIndex + dy));
                popupList.positionViewAtIndex(workspace.popupIndex, ListView.Contain);
            } else
                workspace.selectNode(Navigation.move(workspace.nodeGeometry(), workspace.activeNodeId, dx, dy));
        }
        onActivate: workspace.activate()
        onEdit: {
            var n = workspace.nodes.find(function (n) {
                return n.id === workspace.activeNodeId;
            });
            if (n?.editAction)
                n.editAction();
        }
        onClear: {
            var n = workspace.nodes.find(function (n) {
                return n.id === workspace.activeNodeId;
            });
            if (n?.clearAction)
                n.clearAction();
        }
        onBack: workspace.back()
        onOpenDrawer: workspace.openDrawer(true)
        onCloseDrawer: workspace.closeDrawer()
        onSwitchColumn: direction => {
            if (!workspace.expanded) {
                workspace.activeField = direction < 0 ? "entry" : "description";
                workspace.closeDrawer();
            } else
                workspace.selectNode(Navigation.switchColumn(workspace.nodeGeometry(), workspace.activeNodeId, direction));
        }
        onUndo: {
            workspace.draft = State.undoDraft(workspace.draft);
            workspace.stateDirty = true;
            stateTimer.restart();
        }
        onRedo: {
            workspace.draft = State.redoDraft(workspace.draft);
            workspace.stateDirty = true;
            stateTimer.restart();
        }
        onTab: direction => {
            var geometry = workspace.nodeGeometry().filter(function (n) {
                return n.enabled;
            });
            var index = geometry.findIndex(function (n) {
                return n.id === workspace.activeNodeId;
            });
            if (geometry.length)
                workspace.selectNode(geometry[(index + direction + geometry.length) % geometry.length].id);
        }
    }
    PointerMoveGate {
        id: pointerGate
        referenceItem: workspace
    }
    HoverHandler {
        id: hover
        onPointChanged: {
            if (!pointerGate.moved(workspace, {
                x: point.position.x,
                y: point.position.y
            }))
                return;
            var p = point.position;
            var edge = p.y > workspace.height - 7 && Math.abs(p.x - workspace.width / 2) < 90;
            if (!edge)
                workspace.hoverSuppressed = false;
            if (edge && !workspace.selecting && !workspace.cropping && !workspace.hoverSuppressed && !workspace.expanded)
                workspace.openDrawer(false);
            if (workspace.drawerMode === "hover" && (p.x < drawer.x || p.x > drawer.x + drawer.width || p.y < drawer.y))
                workspace.closeDrawer();
            if (workspace.popupKind) {
                var local = popupList.contentItem.mapFromItem(workspace, p.x, p.y);
                var index = popupList.indexAt(local.x, local.y);
                if (index >= 0)
                    workspace.popupIndex = index;
                return;
            }
            if (workspace.mode !== "navigation")
                return;
            var geometry = workspace.nodeGeometry();
            for (var n of geometry)
                if (n.enabled && p.x >= n.x && p.x <= n.x + n.width && p.y >= n.y && p.y <= n.y + n.height) {
                    workspace.activeNodeId = n.id;
                    break;
                }
        }
    }

    Rectangle {
        anchors.fill: parent
        color: "#15151b"
    }
    Image {
        id: image
        anchors.fill: parent
        source: workspace.imageUrl
        fillMode: Image.PreserveAspectFit
        onStatusChanged: {
            if (status === Image.Ready && workspace.autoLoad)
                workspace.ocrRequested("full", [workspace.fullPsm]);
            else if (status === Image.Error)
                workspace.error("Screenshot", {
                    error: {
                        message: "Could not load the frozen image."
                    }
                });
        }
    }
    Rectangle {
        anchors.fill: parent
        color: "#18000000"
    }
    MouseArea {
        id: selectionArea
        anchors.fill: parent
        acceptedButtons: Qt.LeftButton | Qt.RightButton
        cursorShape: Qt.IBeamCursor
        enabled: !workspace.saving && !workspace.popupKind
        onPressed: mouse => {
            if (workspace.expanded)
                workspace.closeDrawer();
            var p = workspace.pixelAt(mouse.x, mouse.y);
            workspace.dragAnchor = p;
            workspace.dragFocus = p;
            workspace.dragWords = workspace.words;
            workspace.pressLocal = {
                x: mouse.x,
                y: mouse.y
            };
            workspace.cropping = !!p && !!(mouse.modifiers & Qt.AltModifier);
            workspace.selecting = !!p && !workspace.cropping;
            workspace.activeField = mouse.button === Qt.RightButton ? "description" : "entry";
            workspace.pressedBeforeText = workspace.activeField === "entry" ? workspace.draft.entry.text : workspace.draft.capturedDescription.text;
            workspace.suppressRelease = false;
            workspace.precise = !!(mouse.modifiers & Qt.ControlModifier);
            workspace.dragRange = p && !workspace.cropping ? Selection.rangeAt(workspace.dragWords, p, p, workspace.precise) : null;
        }
        onPositionChanged: mouse => {
            var p = workspace.pixelAt(mouse.x, mouse.y);
            if (!p || !workspace.dragAnchor)
                return;
            workspace.dragFocus = p;
            if (workspace.selecting)
                workspace.dragRange = Selection.rangeAt(workspace.dragWords, workspace.dragAnchor, p, workspace.precise);
        }
        onReleased: mouse => {
            if (workspace.suppressRelease) {
                workspace.suppressRelease = false;
            } else if (workspace.cropping && workspace.dragAnchor && workspace.dragFocus) {
                var a = workspace.dragAnchor, b = workspace.dragFocus;
                var x = Math.floor(Math.min(a.x, b.x)), y = Math.floor(Math.min(a.y, b.y));
                var w = Math.ceil(Math.max(a.x, b.x)) - x, h = Math.ceil(Math.max(a.y, b.y)) - y;
                if (w >= 8 && h >= 8) {
                    workspace.ocrLoading = true;
                    workspace.ocrRequested("crop", [String(x), String(y), String(w), String(h), workspace.retryPsm]);
                }
            } else if (workspace.dragRange) {
                workspace.setSelection(workspace.dragRange, workspace.dragWords);
                workspace.completedClick = workspace.pressLocal && Math.hypot(mouse.x - workspace.pressLocal.x, mouse.y - workspace.pressLocal.y) < 4 ? {
                    field: workspace.activeField,
                    beforeText: workspace.pressedBeforeText
                } : null;
            } else
                workspace.completedClick = null;
            workspace.cropping = false;
            workspace.selecting = false;
            workspace.dragRange = null;
            workspace.dragAnchor = null;
            workspace.closeDrawer();
        }
        onDoubleClicked: mouse => {
            var field = mouse.button === Qt.RightButton ? "description" : "entry";
            if (workspace.completedClick?.field === field)
                workspace.updateText(field, workspace.completedClick.beforeText, false);
            workspace.clearHighlight(field);
            workspace.suppressRelease = true;
            workspace.completedClick = null;
        }
        onCanceled: {
            workspace.selecting = false;
            workspace.cropping = false;
            workspace.dragRange = null;
            workspace.dragAnchor = null;
        }
    }
    Repeater {
        model: workspace.usingRetry ? workspace.retryWords : []
        Rectangle {
            required property var modelData
            required property int index
            objectName: "recognized-word-" + index
            x: workspace.screenX(modelData.x)
            y: workspace.screenY(modelData.y)
            width: modelData.width * image.paintedWidth / image.sourceSize.width
            height: modelData.height * image.paintedHeight / image.sourceSize.height
            color: "transparent"
            border.color: "#80cbdbee"
            border.width: 1
        }
    }
    Repeater {
        model: ["entry", "description"]
        Item {
            id: selectionGroup
            required property string modelData
            readonly property var selected: modelData === "entry" ? workspace.draft.entry : workspace.draft.capturedDescription
            readonly property var boxes: Selection.highlightBoxes(workspace.selecting && workspace.activeField === modelData ? workspace.dragWords : selected.sourceWords, workspace.selecting && workspace.activeField === modelData ? workspace.dragRange : selected.selection)
            Repeater {
                model: selectionGroup.boxes
                Rectangle {
                    required property var modelData
                    x: workspace.screenX(modelData.x)
                    y: workspace.screenY(modelData.y)
                    width: modelData.width * image.paintedWidth / image.sourceSize.width
                    height: modelData.height * image.paintedHeight / image.sourceSize.height
                    color: selectionGroup.modelData === "entry" ? "#806bb8ff" : "#80ffb66d"
                    border.color: selectionGroup.modelData === "entry" ? "#b9d9ff" : "#ffe0b1"
                    radius: 2
                }
            }
        }
    }
    Repeater {
        model: !workspace.selecting && (workspace.activeField === "entry" ? workspace.draft.entry.selection : workspace.draft.capturedDescription.selection) ? 2 : 0
        Rectangle {
            id: handle
            required property int index
            readonly property var field: workspace.activeField === "entry" ? workspace.draft.entry : workspace.draft.capturedDescription
            readonly property string side: index === 0 ? "start" : "end"
            readonly property var edge: Selection.handleBox(field.sourceWords, field.selection, side)
            x: workspace.screenX(edge?.x || 0) - width / 2
            y: workspace.screenY((edge?.y || 0) + (index === 0 ? 0 : edge?.height || 0)) - height / 2
            width: 18
            height: 18
            radius: 9
            color: workspace.activeField === "entry" ? "#b9d9ff" : "#ffe0b1"
            MouseArea {
                anchors.fill: parent
                onPositionChanged: mouse => {
                    if (!pressed)
                        return;
                    var local = mapToItem(workspace, mouse.x, mouse.y), p = workspace.pixelAt(local.x, local.y);
                    if (p)
                        workspace.setSelection(Selection.moveHandle(handle.field.sourceWords, handle.field.selection, handle.side, p.x, p.y), handle.field.sourceWords);
                }
            }
        }
    }
    Rectangle {
        visible: workspace.cropping && !!workspace.dragAnchor && !!workspace.dragFocus
        x: workspace.screenX(Math.min(workspace.dragAnchor?.x || 0, workspace.dragFocus?.x || 0))
        y: workspace.screenY(Math.min(workspace.dragAnchor?.y || 0, workspace.dragFocus?.y || 0))
        width: Math.abs((workspace.dragAnchor?.x || 0) - (workspace.dragFocus?.x || 0)) * image.paintedWidth / Math.max(1, image.sourceSize.width)
        height: Math.abs((workspace.dragAnchor?.y || 0) - (workspace.dragFocus?.y || 0)) * image.paintedHeight / Math.max(1, image.sourceSize.height)
        color: "#3349baf0"
        border.color: "#a8d9ff"
        border.width: 2
    }
    Text {
        anchors.top: parent.top
        anchors.topMargin: 16
        anchors.horizontalCenter: parent.horizontalCenter
        text: workspace.ocrLoading ? "Recognizing text…" : "Left drag: Entry · Right drag: Description · Ctrl: precise · Alt: OCR retry"
        color: Tokens.surfaceText
        font: Tokens.label
        Rectangle {
            anchors.fill: parent
            anchors.margins: -8
            color: Tokens.surface
            radius: 12
            z: -1
        }
    }
    CaptureButton {
        objectName: "ocr-view-toggle"
        visible: workspace.retryWords.length > 0 && !workspace.expanded
        anchors.top: parent.top
        anchors.topMargin: 60
        anchors.horizontalCenter: parent.horizontalCenter
        text: workspace.usingRetry ? "Full OCR" : "Crop OCR"
        onClicked: workspace.usingRetry = !workspace.usingRetry
    }
    Item {
        id: compact
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 16
        anchors.horizontalCenter: parent.horizontalCenter
        width: Math.min(560, parent.width - 32)
        height: 84
        clip: true
        visible: !workspace.expanded
        CaptureField {
            id: compactEntry
            x: workspace.activeField === "entry" ? 0 : -compact.width
            width: compact.width
            height: compact.height
            label: "Entry"
            text: workspace.draft.entry.text
            editing: workspace.mode === "compact-edit" && workspace.activeField === "entry" && !workspace.selecting && !workspace.cropping
            Component.onCompleted: editor.Keys.forwardTo = [keys]
            onEdited: text => workspace.updateText("entry", text, false)
            Behavior on x {
                Anim {
                    type: Anim.FastSpatial
                }
            }
        }
        CaptureField {
            id: compactDescription
            x: workspace.activeField === "description" ? 0 : compact.width
            width: compact.width
            height: compact.height
            label: "Description"
            text: workspace.draft.capturedDescription.text
            editing: workspace.mode === "compact-edit" && workspace.activeField === "description" && !workspace.selecting && !workspace.cropping
            Component.onCompleted: editor.Keys.forwardTo = [keys]
            onEdited: text => workspace.updateText("description", text, false)
            Behavior on x {
                Anim {
                    type: Anim.FastSpatial
                }
            }
        }
    }

    component WorkflowField: CaptureField {
        id: field
        property string nodeId
        property string section: "config"
        objectName: nodeId
        property string registeredId: ""
        property bool retired: false
        active: workspace.activeNodeId === nodeId
        editing: workspace.mode === "editing" && workspace.editingNodeId === nodeId
        onEdited: text => workspace.updateText(nodeId, text, false)
        onRequestActivate: {
            workspace.drawerMode = "pinned";
            workspace.selectNode(nodeId);
            keys.forceActiveFocus();
        }
        onRequestEdit: workspace.edit(nodeId)
        onClearRequested: workspace.clear(nodeId)
        function register() {
            if (retired)
                return;
            if (registeredId)
                workspace.unregisterNode(registeredId, field);
            registeredId = nodeId;
            editor.Keys.forwardTo = [keys];
            workspace.registerNode(nodeId, section, field, function () {
                if (nodeId === "instruction")
                    workspace.openPicker("instruction");
            }, function () {
                workspace.edit(nodeId);
            }, function () {
                workspace.clear(nodeId);
            });
        }
        onNodeIdChanged: {
            if (registeredId)
                register();
        }
        Component.onCompleted: register()
        Component.onDestruction: {
            // Repeater bindings can still change while a delegate is being removed.
            retired = true;
            workspace.unregisterNode(registeredId, field);
        }
    }
    component WorkflowButton: CaptureButton {
        id: button
        property string nodeId
        property string section: "config"
        property string registeredId: ""
        property bool retired: false
        objectName: nodeId
        signal perform
        active: workspace.activeNodeId === nodeId
        onClicked: {
            workspace.drawerMode = "pinned";
            workspace.selectNode(nodeId);
            perform();
            keys.forceActiveFocus();
        }
        function register() {
            if (retired)
                return;
            if (registeredId)
                workspace.unregisterNode(registeredId, button);
            registeredId = nodeId;
            workspace.registerNode(nodeId, section, button, function () {
                button.perform();
            }, null, null);
        }
        onNodeIdChanged: {
            if (registeredId)
                register();
        }
        Component.onCompleted: register()
        Component.onDestruction: {
            retired = true;
            workspace.unregisterNode(registeredId, button);
        }
    }
    BottomSurface {
        id: drawer
        objectName: "capture-drawer"
        expanded: workspace.expanded
        readonly property real columnWidth: 460
        readonly property real senseWidth: workspace.draft.suggestions.length || workspace.suggestionLoading ? columnWidth : 0
        readonly property real leftExtent: senseWidth > 0 ? columnWidth + 33 : 0
        readonly property real configWidth: columnWidth
        readonly property real resultsWidth: columnWidth
        width: columnWidth * 2 + 65 + leftExtent
        height: configColumn.implicitHeight + padding * 2
        x: Math.max(8, Math.min(workspace.width - width - 8, (workspace.width - configWidth) / 2 - leftExtent - padding))
        y: workspace.height - height
        padding: 16
        MouseArea {
            anchors.fill: parent
            anchors.margins: -drawer.padding
            acceptedButtons: Qt.AllButtons
            onPressed: {
                workspace.drawerMode = "pinned";
                if (workspace.mode === "navigation")
                    keys.forceActiveFocus();
            }
            onWheel: wheel => {
                wheel.accepted = true;
            }
        }
        Row {
            anchors.fill: parent
            spacing: 16
            Column {
                objectName: "senses-column"
                visible: drawer.senseWidth > 0
                width: drawer.columnWidth
                height: parent.height
                spacing: 12
                Text {
                    text: workspace.suggestionLoading ? "Suggesting Senses…" : "Suggested Senses"
                    font: Tokens.title
                    color: Tokens.surfaceText
                }
                CaptureListView {
                    id: senseList
                    width: parent.width
                    height: parent.height - 40
                    spacing: 8
                    model: workspace.draft.suggestions
                    delegate: WorkflowButton {
                        id: senseCard
                        required property var modelData
                        required property int index
                        width: senseList.width
                        height: Math.max(80, contentItem.implicitHeight + topPadding + bottomPadding + 12)
                        nodeId: "suggestion-" + index
                        section: "senses"
                        text: modelData.name + "\n" + modelData.definition
                        contentItem: Column {
                            spacing: 6
                            readonly property bool truncated: senseNameText.truncated || senseDefinitionText.truncated
                            Text {
                                id: senseNameText
                                width: parent.width
                                text: senseCard.modelData.name
                                textFormat: Text.PlainText
                                wrapMode: Text.Wrap
                                font: Tokens.title
                                color: Tokens.surfaceText
                            }
                            Text {
                                id: senseDefinitionText
                                width: parent.width
                                text: senseCard.modelData.definition
                                textFormat: Text.PlainText
                                wrapMode: Text.Wrap
                                font: Tokens.body
                                color: Tokens.surfaceVariantText
                            }
                        }
                        enabled: !workspace.saving && !!workspace.selectedModel && workspace.draft.selectedTypes.length > 0
                        onPerform: workspace.chooseSense(modelData.name)
                    }
                }
            }
            Rectangle {
                visible: drawer.senseWidth > 0
                width: 1
                height: parent.height
                color: Tokens.outlineVariant
            }
            Column {
                id: configColumn
                objectName: "config-column"
                width: drawer.configWidth
                spacing: 12
                Column {
                    id: configContent
                    width: parent.width
                    spacing: 8
                    WorkflowField {
                        nodeId: "entry"
                        label: "Entry"
                        width: parent.width
                        height: Math.max(88, implicitHeight)
                        text: workspace.draft.entry.text
                        enabled: !workspace.saving && !workspace.savedAlready
                    }
                    WorkflowField {
                        nodeId: "description"
                        label: "Description"
                        width: parent.width
                        height: Math.max(112, implicitHeight)
                        text: workspace.draft.capturedDescription.text
                        enabled: !workspace.saving && !workspace.savedAlready
                    }
                    WorkflowField {
                        nodeId: "instruction"
                        label: "Instruction"
                        width: parent.width
                        height: Math.max(176, implicitHeight)
                        text: workspace.draft.instructionText
                        enabled: !workspace.saving
                        CaptureButton {
                            anchors.right: parent.right
                            anchors.top: parent.top
                            anchors.margins: 8
                            width: 34
                            height: 28
                            text: "⌄"
                            onClicked: workspace.openPicker("instruction")
                        }
                    }
                    WorkflowButton {
                        nodeId: "model"
                        width: parent.width
                        text: workspace.selectedModel || "Choose a Model"
                        enabled: !workspace.saving
                        onPerform: workspace.openPicker("model")
                    }
                    Text {
                        text: "Description Types to generate"
                        font: Tokens.label
                        color: Tokens.surfaceVariantText
                    }
                    Flow {
                        width: parent.width
                        spacing: 6
                        Repeater {
                            model: ["definition", "translation", "example", "misc"]
                            WorkflowButton {
                                required property string modelData
                                nodeId: "type-" + modelData
                                text: (workspace.draft.selectedTypes.includes(modelData) ? "✓ " : "") + modelData
                                prominent: workspace.draft.selectedTypes.includes(modelData)
                                onPerform: workspace.toggleType(modelData)
                            }
                        }
                    }
                }
                Grid {
                    width: parent.width
                    columns: 2
                    spacing: 8
                    WorkflowButton {
                        nodeId: "save-entry"
                        width: (parent.width - 8) / 2
                        text: workspace.saving ? "Saving…" : "Save Entry"
                        enabled: !!workspace.draft.entry.text.trim() && !workspace.saving && !workspace.savedAlready
                        onPerform: workspace.save("entry")
                    }
                    WorkflowButton {
                        nodeId: "cancel"
                        width: (parent.width - 8) / 2
                        text: "Cancel"
                        enabled: !workspace.saving
                        onPerform: workspace.requestExit()
                    }
                    WorkflowButton {
                        nodeId: "suggest"
                        width: (parent.width - 8) / 2
                        text: "Suggest Senses"
                        enabled: !!workspace.draft.entry.text.trim() && !!workspace.selectedModel && !workspace.suggestionLoading && !workspace.saving
                        onPerform: workspace.suggest()
                    }
                    WorkflowButton {
                        nodeId: "generate"
                        width: (parent.width - 8) / 2
                        text: workspace.generationLoading ? "Generating…" : "Generate"
                        prominent: true
                        enabled: workspace.canGenerate && !workspace.saving && !workspace.generationLoading
                        onPerform: workspace.generate(false)
                    }
                }
            }
            Rectangle {
                width: 1
                height: parent.height
                color: Tokens.outlineVariant
            }
            Column {
                objectName: "results-column"
                width: drawer.resultsWidth
                height: parent.height
                spacing: 12
                Flickable {
                    id: resultScroll
                    objectName: "results-scroll"
                    width: parent.width
                    height: parent.height - 52
                    contentHeight: resultContent.height
                    onContentHeightChanged: Qt.callLater(function () {
                        if (workspace.expanded && workspace.mode === "navigation")
                            workspace.selectNode(workspace.activeNodeId);
                    })
                    clip: true
                    ScrollBar.vertical: ScrollBar {}
                    Column {
                        id: resultContent
                        width: resultScroll.width
                        spacing: 8
                        WorkflowField {
                            nodeId: "sense"
                            section: "results"
                            label: "Sense"
                            width: parent.width
                            height: 78
                            text: workspace.draft.senseName
                            enabled: !workspace.saving && !workspace.savedAlready
                        }
                        Repeater {
                            model: workspace.draft.descriptions.length
                            WorkflowField {
                                required property int index
                                readonly property var modelData: workspace.draft.descriptions[index] || {
                                    key: "removed-" + index,
                                    type: "misc",
                                    text: ""
                                }
                                nodeId: modelData.key
                                section: "results"
                                label: modelData.type
                                text: modelData.text
                                width: resultContent.width
                                height: 118
                                enabled: !workspace.saving && !workspace.savedAlready
                            }
                        }
                        Row {
                            spacing: 4
                            Repeater {
                                model: ["definition", "translation", "example", "misc"]
                                WorkflowButton {
                                    required property string modelData
                                    nodeId: "add-" + modelData
                                    section: "results"
                                    text: "+ " + modelData
                                    fontStyle: Tokens.label
                                    onPerform: {
                                        var next = State.copy(workspace.draft);
                                        next.descriptions.push({
                                            key: modelData + "-" + Date.now(),
                                            type: modelData,
                                            text: "",
                                            edited: false
                                        });
                                        next.descriptions.sort(function (a, b) {
                                            return ["definition", "translation", "example", "misc"].indexOf(a.type) - ["definition", "translation", "example", "misc"].indexOf(b.type);
                                        });
                                        workspace.draft = next;
                                    }
                                }
                            }
                        }
                    }
                }
                Row {
                    width: parent.width
                    spacing: 8
                    WorkflowButton {
                        nodeId: "save-sense"
                        section: "results"
                        width: (parent.width - 8) / 2
                        text: "Save Sense"
                        enabled: workspace.canSaveSense && !workspace.saving && !workspace.savedAlready
                        onPerform: workspace.save("sense")
                    }
                    WorkflowButton {
                        nodeId: "save-all"
                        section: "results"
                        width: (parent.width - 8) / 2
                        text: "Save All"
                        prominent: true
                        enabled: workspace.canSaveSense && !workspace.saving && !workspace.savedAlready
                        onPerform: workspace.save("sense-all")
                    }
                }
            }
        }
    }
    Rectangle {
        id: errorBox
        visible: !!workspace.notification && workspace.expanded
        x: drawer.x
        y: Math.max(48, drawer.y - height - 8)
        width: drawer.width
        height: errorText.implicitHeight + 28
        color: Tokens.surfaceContainerHigh
        radius: 12
        Text {
            id: errorText
            objectName: "configuration-notification"
            textFormat: Text.PlainText
            anchors.left: parent.left
            anchors.top: parent.top
            anchors.margins: 14
            width: parent.width - copyButton.width - 48
            text: workspace.notification
            wrapMode: Text.Wrap
            font: Tokens.body
            color: Tokens.error
        }
        WorkflowButton {
            id: copyButton
            nodeId: "copy-drafts"
            enabled: !!workspace.notification && workspace.expanded
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            anchors.rightMargin: 12
            text: "Copy drafts"
            onPerform: workspace.copyDrafts()
        }
    }
    MouseArea {
        anchors.fill: parent
        visible: !!workspace.popupKind
        onClicked: {
            workspace.popupKind = "";
            workspace.mode = "navigation";
            keys.forceActiveFocus();
        }
    }
    Rectangle {
        id: popup
        objectName: "instruction-picker"
        visible: !!workspace.popupKind
        x: drawer.x + drawer.leftExtent + 16
        y: Math.max(8, drawer.y + 100)
        width: drawer.configWidth
        height: Math.min(320, workspace.height - y - 24)
        radius: 12
        color: Tokens.surfaceContainerHighest
        border.color: Tokens.outline
        CaptureListView {
            id: popupList
            anchors.fill: parent
            anchors.margins: 8
            model: workspace.popupKind === "instruction" ? workspace.instructions : workspace.models
            delegate: CaptureButton {
                required property var modelData
                required property int index
                width: popupList.width
                height: 58
                active: workspace.popupIndex === index
                text: workspace.popupKind === "instruction" ? modelData.name || modelData.text : modelData.id
                onClicked: workspace.choosePopup(index)
            }
        }
        Text {
            anchors.centerIn: parent
            visible: popupList.count === 0
            text: "No saved choices"
            font: Tokens.body
            color: Tokens.surfaceVariantText
        }
    }
}
