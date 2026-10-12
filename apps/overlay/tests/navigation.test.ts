import { expect, test } from "bun:test";
import vm from "node:vm";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type Node = {
  id: string;
  section: "senses" | "config" | "results";
  x: number;
  y: number;
  width: number;
  height: number;
  enabled: boolean;
};
type Navigation = {
  move(
    nodes: Node[],
    activeId: string | null,
    dx: number,
    dy: number
  ): string | null;
  switchColumn(
    nodes: Node[],
    activeId: string | null,
    direction: number
  ): string | null;
  repair(nodes: Node[], activeId: string | null): string | null;
};

async function navigation(): Promise<Navigation> {
  const source = await Bun.file(
    new URL("../qml/navigation.js", import.meta.url)
  ).text();
  return vm.runInNewContext(
    `${source}\n({ move, switchColumn, repair })`
  ) as Navigation;
}

function node(
  id: string,
  x: number,
  y: number,
  section: Node["section"] = "config"
): Node {
  return { id, section, x, y, width: 20, height: 20, enabled: true };
}

test("spatial movement prefers an aligned control over a closer diagonal control", async () => {
  const nav = await navigation();
  const nodes = [
    node("origin", 0, 0),
    node("diagonal", 25, 25),
    node("aligned", 80, 5),
  ];
  expect(nav.move(nodes, "origin", 1, 0)).toBe("aligned");
});

test("spatial movement uses geometry in every direction, skips disabled controls, and keeps stable ties", async () => {
  const nav = await navigation();
  const nodes = [
    node("right-far", 90, 0),
    node("down", 0, 50),
    node("origin", 0, 0),
    node("left", -50, 0),
    node("up", 0, -50),
    { ...node("disabled", 25, 0), enabled: false },
    node("right-first", 50, 0),
    node("right-tie", 50, 0),
  ];
  expect(nav.move(nodes, "origin", 1, 0)).toBe("right-first");
  expect(nav.move(nodes, "origin", -1, 0)).toBe("left");
  expect(nav.move(nodes, "origin", 0, 1)).toBe("down");
  expect(nav.move(nodes, "origin", 0, -1)).toBe("up");
  expect(nav.move(nodes, "right-far", 1, 0)).toBeNull();
  expect(nav.move(nodes, "origin", 0, 0)).toBeNull();
  expect(nav.move([], null, 1, 0)).toBeNull();
  expect(
    nav.move([node("diagonal", 50, 50), node("origin", 0, 0)], "origin", 1, 0)
  ).toBe("diagonal");
});

test("column switching skips absent or disabled Senses and preserves the nearest row", async () => {
  const nav = await navigation();
  const nodes = [
    { ...node("sense", -100, 40, "senses"), enabled: false },
    node("entry", 0, 0),
    node("instruction", 0, 40),
    node("result-top", 100, 0, "results"),
    node("result-row", 100, 45, "results"),
  ];
  expect(nav.switchColumn(nodes, "instruction", 1)).toBe("result-row");
  expect(nav.switchColumn(nodes, "result-row", -1)).toBe("instruction");
  expect(nav.switchColumn(nodes, "instruction", -1)).toBeNull();
  nodes[0]!.enabled = true;
  expect(nav.switchColumn(nodes, "instruction", -1)).toBe("sense");
  expect(nav.switchColumn(nodes, "result-row", 1)).toBeNull();
});

test("ordinary spatial movement stays in the active column", async () => {
  const nav = await navigation();
  const nodes = [node("entry", 0, 0), node("sense", 100, 0, "results")];
  expect(nav.move(nodes, "entry", 1, 0)).toBeNull();
  expect(nav.switchColumn(nodes, "entry", 1)).toBe("sense");
});

test("repair preserves stable IDs across reorder and stays in the section when a control is disabled", async () => {
  const nav = await navigation();
  const nodes = [
    node("entry", 0, 0),
    node("result", 100, 20, "results"),
    node("next-result", 100, 45, "results"),
  ];
  expect(nav.repair(nodes.slice().reverse(), "result")).toBe("result");
  nodes[1]!.enabled = false;
  expect(nav.repair(nodes, "result")).toBe("next-result");
  expect(nav.repair(nodes, "removed")).toBe("entry");
  expect(nav.repair([], "result")).toBeNull();
  expect(
    nav.repair(
      nodes.map((item) => ({ ...item, enabled: false })),
      "result"
    )
  ).toBeNull();
});

async function checkQml(body: string) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "dictos-navigation-")
  );
  const qmlDirectory = new URL("../qml/", import.meta.url).href;
  await Bun.write(
    path.join(directory, "tst_navigation.qml"),
    `
import QtQuick
import QtTest
import "${qmlDirectory}" as Overlay
import "${qmlDirectory}navigation.js" as Navigation
Item {
  width: 640; height: 480
  ${body}
}
`
  );
  const result = Bun.spawnSync(
    ["qmltestrunner", "-input", directory, "-platform", "offscreen"],
    {
      env: { ...process.env, QT_QUICK_BACKEND: "software" },
      stdout: "pipe",
      stderr: "pipe",
    }
  );
  await fs.rm(directory, { recursive: true, force: true });
  expect(result.stdout.toString() + result.stderr.toString()).toContain(
    "0 failed"
  );
  expect(result.exitCode).toBe(0);
}

test("key catcher emits navigation intents while editing keeps typing and native undo", async () => {
  await checkQml(`
  property var intents: []
  function record(value) { intents = intents.concat([value]) }
  Overlay.PanelKeyCatcher {
    id: catcher
    onMove: function(dx, dy) { record("move:" + dx + ":" + dy) }
    onActivate: record("activate")
    onEdit: record("edit")
    onBack: record("back")
    onSwitchColumn: function(direction) { record("column:" + direction) }
    onOpenDrawer: record("open")
    onCloseDrawer: record("close")
    onUndo: record("undo")
    onRedo: record("redo")
    onClear: record("clear")
    onTab: function(direction) { record("tab:" + direction) }
  }
  TextInput { id: editor; Keys.forwardTo: [catcher] }
  TestCase {
    name: "Keys"; when: windowShown
    function press(item, key, modifiers) {
      item.forceActiveFocus()
      keyClick(key, modifiers || Qt.NoModifier)
    }
    function test_modes() {
      compare(Navigation.repair([{ id: "entry", enabled: true }], null), "entry")
      catcher.forceActiveFocus()
      press(catcher, Qt.Key_H)
      press(catcher, Qt.Key_Down)
      press(catcher, Qt.Key_Return)
      press(catcher, Qt.Key_I)
      press(catcher, Qt.Key_D)
      press(catcher, Qt.Key_Backspace)
      press(catcher, Qt.Key_U)
      press(catcher, Qt.Key_Z, Qt.ControlModifier)
      press(catcher, Qt.Key_Z, Qt.ControlModifier | Qt.ShiftModifier)
      press(catcher, Qt.Key_R, Qt.ControlModifier)
      press(catcher, Qt.Key_Tab)
      press(catcher, Qt.Key_Backtab, Qt.ShiftModifier)
      compare(intents.join(","), "move:-1:0,move:0:1,activate,edit,clear,clear,undo,undo,redo,redo,tab:1,tab:-1")
      intents = []
      catcher.mode = "editing"
      editor.forceActiveFocus()
      for (var letter of "hjklidu") keyClick(letter)
      compare(editor.text, "hjklidu")
      press(editor, Qt.Key_Z, Qt.ControlModifier)
      compare(editor.text, "")
      compare(intents.length, 0)
      press(editor, Qt.Key_H, Qt.ControlModifier)
      press(editor, Qt.Key_L, Qt.ControlModifier)
      press(editor, Qt.Key_K, Qt.ControlModifier)
      press(editor, Qt.Key_J, Qt.ControlModifier)
      press(editor, Qt.Key_Escape)
      compare(intents.join(","), "column:-1,column:1,open,close,back")
      intents = []
      catcher.mode = "compact-edit"
      press(editor, Qt.Key_I)
      press(editor, Qt.Key_K, Qt.ControlModifier)
      compare(editor.text, "i")
      compare(intents.join(","), "open")
      intents = []
      catcher.mode = "popup"
      catcher.forceActiveFocus()
      press(catcher, Qt.Key_J)
      press(catcher, Qt.Key_Up)
      press(catcher, Qt.Key_Left)
      press(catcher, Qt.Key_Right)
      press(catcher, Qt.Key_Return)
      press(catcher, Qt.Key_Escape)
      press(catcher, Qt.Key_H)
      press(catcher, Qt.Key_K, Qt.ControlModifier)
      press(catcher, Qt.Key_Z, Qt.ControlModifier)
      press(catcher, Qt.Key_Tab)
      compare(intents.join(","), "move:0:1,move:0:-1,move:-1:0,move:1:0,activate,back")
    }
  }
  `);
});

test("pointer gate ignores moving controls under a stationary pointer and accumulates real movement", async () => {
  await checkQml(`
  id: scene
  Item { id: row; x: 20; y: 30; width: 100; height: 20 }
  Overlay.PointerMoveGate { id: gate; referenceItem: scene }
  TestCase {
    name: "Pointer"; when: windowShown
    function test_movement() {
      verify(!gate.moved(row, { x: 10, y: 5 }))
      row.x = 25
      verify(!gate.moved(row, { x: 5, y: 5 }))
      verify(!gate.moved(row, { x: 5.6, y: 5 }))
      verify(gate.moved(row, { x: 6.2, y: 5 }))
      gate.reset()
      verify(!gate.moved(row, { x: 6.2, y: 5 }))
      gate.allowInitialSample()
      verify(gate.moved(row, { x: 6.2, y: 5 }))
      verify(!gate.moved(row, { x: 6.2, y: 5 }))
      gate.referenceItem = null
      gate.reset()
      verify(!gate.moved(row, { x: 6.2, y: 5 }))
      row.y += 10
      verify(!gate.moved(row, { x: 6.2, y: -5 }))
      verify(gate.moved(row, { x: 6.2, y: -3 }))
      verify(!gate.moved(null, null))
      verify(!gate.moved(row, { x: 6.2, y: -3 }))
    }
  }
  `);
});
