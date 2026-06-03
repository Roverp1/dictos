import { useState } from "react";
import { useKeyboard, useRenderer } from "@opentui/react";
import { Route, Routes } from "react-router-dom";

import { appRoutes } from "./routes/route";
import { AppLayout } from "./layout/app-layout";

export const App = () => {
  const renderer = useRenderer();

  useKeyboard((key) => {
    if (key.name === "f12") {
      renderer.console.toggle();
    }
  });

  return (
    <Routes>
      <Route element={<AppLayout />}>{appRoutes}</Route>
    </Routes>
  );
};
