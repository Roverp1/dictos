import { Route, Routes, Navigate } from "react-router-dom";
import { AppLayout } from "./layout/app-layout";
import { DictionaryPage } from "../pages/dictionary";

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
        <Route
          path="/dictionary"
          element={<DictionaryPage />}
        />
      </Route>
    </Routes>
  );
};
