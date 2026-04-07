import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth, RequireRole } from "./auth/guards";
import { AppShell } from "./components/AppShell";
import { AIPage } from "./pages/AIPage";
import { LoginPage } from "./pages/LoginPage";
import { RealtimePage } from "./pages/RealtimePage";
import {
  DashboardPage,
  InventoryPage,
  SalesPage,
  TrafficPage,
  TransfersPage,
} from "./pages/StorePages";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<RequireRole role="Store" />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/transfers" element={<TransfersPage />} />
            <Route path="/traffic" element={<TrafficPage />} />
            <Route path="/ai" element={<AIPage />} />
            <Route path="/realtime" element={<RealtimePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
