import { ConsolePosition, createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";

import {
  createLibSqlDatabase,
  LibSqlCaptureRepository,
  LibSqlDirectoryRepository,
} from "@dictos/adapters";
import { CaptureService, DirectoryService } from "@dictos/core";

import { DictionaryPage } from "@pages/dictionary";

export const bootstrap = async () => {
  const db = await createLibSqlDatabase("file:./dictos.db");

  const captureRepo = new LibSqlCaptureRepository(db);
  const dirRepo = new LibSqlDirectoryRepository(db);

  const captureService = new CaptureService(captureRepo);
  const dirService = new DirectoryService(dirRepo);

  const renderer = await createCliRenderer({
    consoleOptions: {
      position: ConsolePosition.RIGHT,
      sizePercent: 40,
    },
  });

  createRoot(renderer).render(
    <App
      captureService={captureService}
      directoryService={dirService}
    />
  );
};

interface Props {
  captureService: CaptureService;
  directoryService: DirectoryService;
}

function App({ captureService, directoryService }: Props) {
  const renderer = useRenderer();

  useKeyboard((key) => {
    if (key.name === "f12") {
      renderer.console.toggle();
    }
  });
  return (
    <DictionaryPage
      captureService={captureService}
      directoryService={directoryService}
    />
  );
}
