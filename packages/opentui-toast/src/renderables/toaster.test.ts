import { expect, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { toast } from "../index";
import { ToasterRenderable } from "./toaster";

test("updating a loading Notification shows its new description", async () => {
  const setup = await createTestRenderer({ width: 80, height: 12 });
  const toaster = new ToasterRenderable(setup.renderer, {
    position: "top-right",
  });
  setup.renderer.root.add(toaster);

  const id = toast.loading("Saving Entry");
  toast.success("Entry saved", {
    id,
    description: "Ready in Dictionary",
    duration: Infinity,
  });

  await setup.renderOnce();
  expect(setup.captureCharFrame()).toContain("Ready in Dictionary");

  toaster.destroy();
  setup.renderer.destroy();
  toast.dismiss(id);
});
