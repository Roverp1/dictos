import { ConsolePosition, createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";

import {
  createLibSqlDatabase,
  LibSqlCaptureRepository,
  LibSqlDefinitionRepository,
  LibSqlDirectoryRepository,
} from "@dictos/adapters";
import {
  CaptureService,
  DefinitionService,
  DirectoryService,
} from "@dictos/core";

import { DictionaryPage } from "@pages/dictionary";

export const bootstrap = async () => {
  const db = await createLibSqlDatabase("file:./dictos.db");

  const captureRepo = new LibSqlCaptureRepository(db);
  const dirRepo = new LibSqlDirectoryRepository(db);
  const definitionRepository = new LibSqlDefinitionRepository(db);

  const captureService = new CaptureService(captureRepo);
  const dirService = new DirectoryService(dirRepo);
  const definitionService = new DefinitionService(definitionRepository);

  const renderer = await createCliRenderer({
    consoleOptions: {
      position: ConsolePosition.BOTTOM,
      sizePercent: 40,
    },
  });

  createRoot(renderer).render(
    <App
      captureService={captureService}
      directoryService={dirService}
      definitionService={definitionService}
    />
  );
};

interface Props {
  captureService: CaptureService;
  directoryService: DirectoryService;
  definitionService: DefinitionService;
}

function App({ captureService, directoryService, definitionService }: Props) {
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
      definitionService={definitionService}
    />
  );
}
