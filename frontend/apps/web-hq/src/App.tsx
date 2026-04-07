import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth, RequireRole } from "./auth/guards";
import { AppShell } from "./components/AppShell";
import { AIPage } from "./pages/AIPage";
import {
  SkusPage,
  StoresPage,
  TransfersPage,
  UsersPage,
} from "./pages/DataListPage";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { RealtimePage } from "./pages/RealtimePage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<RequireRole role="Head" />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/stores" element={<StoresPage />} />
            <Route path="/skus" element={<SkusPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/transfers" element={<TransfersPage />} />
            <Route path="/ai" element={<AIPage />} />
            <Route path="/realtime" element={<RealtimePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
