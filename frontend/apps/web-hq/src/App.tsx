import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth, RequireRole } from "./auth/guards";
import { AppShell } from "./components/AppShell";
import {
  SkusPage,
  StoresPage,
  TransfersPage,
  UsersPage,
} from "./pages/DataListPage";
import { LoginPage } from "./pages/LoginPage";
import { ChatPage } from "./pages/ChatPage";
import { OverviewPage } from "./pages/OverviewPage";
import { GlobalAnalyticsPage } from "./pages/GlobalAnalyticsPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<RequireRole role="Head" />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/analytics" element={<GlobalAnalyticsPage />} />
            <Route path="/stores" element={<StoresPage />} />
            <Route path="/skus" element={<SkusPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/transfers" element={<TransfersPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
