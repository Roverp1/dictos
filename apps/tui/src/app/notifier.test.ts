import { expect, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { ToasterRenderable } from "@dictos/opentui-toast";

import { notifier } from "./notifier";

test("a resolved Error remains the result and updates the loading Notification with a description", async () => {
  const setup = await createTestRenderer({ width: 80, height: 12 });
  using cleanup = new DisposableStack();
  cleanup.defer(() => setup.renderer.destroy());

  const toaster = new ToasterRenderable(setup.renderer, {
    position: "top-right",
  });
  setup.renderer.root.add(toaster);
  cleanup.defer(() => toaster.destroy());

  const id = crypto.randomUUID();
  cleanup.defer(() => notifier.dismiss(id));

  const pending = Promise.withResolvers<{ entryId: string } | Error>();
  const resultPromise = notifier.promise(pending.promise, {
    id,
    loading: "Saving Entry",
    error: {
      message: "Entry was not saved",
      description: "Check the Entry and try again",
      duration: Infinity,
    },
  });

  await setup.renderOnce();
  expect(setup.captureCharFrame()).toContain("Saving Entry");

  const failure = new Error("Could not save Entry");
  pending.resolve(failure);
  const result = await resultPromise;
  await setup.renderOnce();

  expect(result).toBe(failure);
  expect(setup.captureCharFrame()).toContain("Entry was not saved");
  expect(setup.captureCharFrame()).toContain("Check the Entry and try again");
});
