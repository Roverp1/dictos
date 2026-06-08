import { Route, Routes, Navigate } from "react-router-dom";
import { AppLayout } from "./layout/app-layout";
import { appRoutes } from "./routes/route";

export const App = () => {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          path="/"
          element={
            <Navigate
              to="/dictionary"
              replace
            />
          }
        />
        {appRoutes}
      </Route>
    </Routes>
  );
};
