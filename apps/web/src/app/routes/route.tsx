import { Route } from "react-router-dom";

import { DictionaryPage } from "@pages/dictionary";
import { AuthPage } from "@pages/auth";

export const appRoutes = (
  <>
    <Route
      path="/dictionary"
      element={<DictionaryPage />}
    />

    <Route
      path="/auth"
      element={<AuthPage />}
    />
  </>
);
