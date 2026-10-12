import QtQuick
import QtTest
import "." as Visuals

Item {
    width: 640
    height: 480

    Component {
        id: fieldComponent
        Visuals.CaptureField {
            width: 300
            height: 120
            label: "Description"
            property string userText: "unchanged"
            property bool selected: false
            property bool cleared: false
            onEdited: text => userText = text
            onRequestActivate: selected = true
            onRequestEdit: editing = true
            onClearRequested: cleared = true
        }
    }

    Component {
        id: buttonComponent
        Visuals.CaptureButton {
            text: "Save Entry"
            property bool activated: false
            onClicked: activated = true
        }
    }

    Component {
        id: surfaceComponent
        Visuals.BottomSurface {
            width: 400
            height: 240
            Visuals.CaptureListView {
                width: 300
                height: 180
                model: 20
                delegate: Visuals.CaptureButton {
                    required property int index
                    text: "Sense " + index
                }
            }
        }
    }

    TestCase {
        name: "OverlayVisuals"
        when: windowShown

        function test_field_routes_real_pointer_and_keyboard_input() {
            const field = createTemporaryObject(fieldComponent, parent);
            verify(field !== null);
            field.text = "Programmatic draft";
            compare(field.userText, "unchanged");
            mouseClick(field, 100, 60);
            verify(field.selected);
            verify(field.readOnly);
            mouseDoubleClickSequence(field, 100, 60);
            tryCompare(field, "editing", true);
            tryCompare(field.editor, "activeFocus", true);
            mouseClick(field.editor, 30, 10);
            keyClick(Qt.Key_A, Qt.ControlModifier);
            keyClick(Qt.Key_X);
            compare(field.text, "x");
            compare(field.userText, "x");
            mouseClick(field, 100, 60, Qt.RightButton);
            verify(!field.cleared);
            field.editing = false;
            mouseClick(field, 100, 60, Qt.RightButton);
            verify(field.cleared);
            compare(field.text, "x");
        }

        function test_button_blocks_disabled_activation() {
            const button = createTemporaryObject(buttonComponent, parent);
            verify(button !== null);
            button.enabled = false;
            mouseClick(button);
            verify(!button.activated);
            button.enabled = true;
            mouseClick(button);
            verify(button.activated);
        }

        function test_surface_and_list_load_and_reveal_offscreen() {
            const surface = createTemporaryObject(surfaceComponent, parent);
            verify(surface !== null);
            surface.expanded = false;
            tryCompare(surface, "visible", false, 1500);
            surface.expanded = true;
            tryCompare(surface, "offsetScale", 0, 1500);
            verify(surface.visible);
            const list = surface.contentItem.children[0];
            list.revealIndex(19);
            verify(list.contentY > 0);
        }
    }
}
