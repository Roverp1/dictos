import { useState } from "react";
import { ConsolePosition, createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";

import {
  createLibSqlDatabase,
  LibSqlCaptureRepository,
  LibSqlDefinitionRepository,
  LibSqlDirectoryRepository,
  LibSqlSessionRepository,
  CentralApiAdapter,
} from "@dictos/adapters";
import {
  AuthService,
  CaptureService,
  DefinitionService,
  DirectoryService,
} from "@dictos/core";

import { DictionaryPage } from "@pages/dictionary";
import { AuthPage } from "@pages/auth";
import { useServicesStore } from "@shared/lib/services";

export const bootstrap = async () => {
  const db = await createLibSqlDatabase("file:./dictos.db");

  const captureRepo = new LibSqlCaptureRepository(db);
  const dirRepo = new LibSqlDirectoryRepository(db);
  const definitionRepository = new LibSqlDefinitionRepository(db);
  const sessionRepository = new LibSqlSessionRepository(db);

  const centralApiAdapter = new CentralApiAdapter("http://localhost:1488/");

  const captureService = new CaptureService(captureRepo);
  const directoryService = new DirectoryService(dirRepo);
  const definitionService = new DefinitionService(definitionRepository);
  const authService = new AuthService(centralApiAdapter, sessionRepository);

  useServicesStore.getState().initServices({
    captureService,
    directoryService,
    definitionService,
  });

  const renderer = await createCliRenderer({
    consoleOptions: {
      position: ConsolePosition.BOTTOM,
      sizePercent: 40,
    },
  });

  createRoot(renderer).render(<App authService={authService} />);
};

export type Route = "auth" | "dictionary";

interface Props {
  authService: AuthService;
}

function App({ authService }: Props) {
  const [route, setRoute] = useState<Route>("auth");

  const renderer = useRenderer();

  useKeyboard((key) => {
    if (key.name === "f12") {
      renderer.console.toggle();
    }

    if (key.shift && key.name === "tab") {
      setRoute((prev) => (prev === "auth" ? "dictionary" : "auth"));
    }
  });

  if (route === "auth") return <AuthPage authService={authService} />;

  return <DictionaryPage />;
}
