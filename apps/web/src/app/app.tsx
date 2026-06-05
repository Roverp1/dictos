import { Route, Routes } from "react-router-dom";

import { appRoutes } from "./routes/route";
import { AppLayout } from "./layout/app-layout";

export const App = () => {
  return (
    <Routes>
      <Route element={<AppLayout />}>{appRoutes}</Route>
    </Routes>
  );
};
