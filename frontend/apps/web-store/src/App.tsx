import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth, RequireRole } from "./auth/guards";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";
import {
  ChangePasswordPage,
  ChatPage,
  InventoryPage,
  SalesPage,
  StoreInfoPage,
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
            <Route path="/" element={<SalesPage />} />
            <Route path="/sales" element={<Navigate to="/" replace />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/traffic" element={<TrafficPage />} />
            <Route path="/store" element={<StoreInfoPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/transfers" element={<TransfersPage />} />
            <Route path="/account/password" element={<ChangePasswordPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
