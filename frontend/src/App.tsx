import { Route, Routes } from 'react-router-dom';
import { TicketList } from './features/tickets/components/TicketList.tsx';
import { TicketDetail } from './features/tickets/components/TicketDetail.tsx';
import { TicketReport } from './features/tickets/components/TicketReport.tsx';
import { ActivityList } from './features/activities/components/ActivityList.tsx';
import { ActivityDetail } from './features/activities/components/ActivityDetail.tsx';
import { DeviceList } from './features/devices/components/DeviceList.tsx';
import { DeviceDetail } from './features/devices/components/DeviceDetail.tsx';
import { DeviceReport } from './features/devices/components/DeviceReport.tsx';
import { InventoryList } from './features/inventory/components/InventoryList.tsx';
import { InventoryDetail } from './features/inventory/components/InventoryDetail.tsx';
import { InventoryReport } from './features/inventory/components/InventoryReport.tsx';
import { RootRoute } from './shared/components/RootRoute.tsx';
import { SettingsPage } from './features/settings/components/SettingsPage.tsx';
import { ChannelsSettingsPage } from './features/settings/components/ChannelsSettingsPage.tsx';
import { CompaniesPage } from './features/companies/components/CompaniesPage.tsx';
import { UsersPage } from './features/users/components/UsersPage.tsx';
import { LogsPage } from './features/audit/components/LogsPage.tsx';
import { AgentsPage } from './features/agents/components/AgentsPage.tsx';
import { RemoteConnectPage } from './features/remotely/components/RemoteConnectPage.tsx';
import { SecurityPage } from './features/account/components/SecurityPage.tsx';
import { LoginPage } from './features/auth/components/LoginPage.tsx';
import { PublicTicketForm } from './features/tickets/components/PublicTicketForm.tsx';
import { PublicChatWidget } from './features/conversations/components/PublicChatWidget.tsx';
import { SupportLandingPage } from './features/support/components/SupportLandingPage.tsx';
import { TermsPage } from './features/legal/components/TermsPage.tsx';
import { PrivacyPage } from './features/legal/components/PrivacyPage.tsx';
import { MessagesPage } from './shared/components/MessagesPage.tsx';
import { MessengerLayout } from './features/messenger/components/MessengerLayout.tsx';
import { PublicQuoteApproval } from './features/quotes/components/PublicQuoteApproval.tsx';
import { PendingApprovalsPage } from './features/quotes/components/PendingApprovalsPage.tsx';
import { QuoteList } from './features/quotes/components/QuoteList.tsx';
import { QuoteDetail } from './features/quotes/components/QuoteDetail.tsx';
import { ProtectedRoute } from './shared/components/ProtectedRoute.tsx';
import { AdminRoute } from './shared/components/AdminRoute.tsx';
import { StaffRoute } from './shared/components/StaffRoute.tsx';
import { ClienteRoute } from './shared/components/ClienteRoute.tsx';
import { AppLayout } from './shared/components/AppLayout.tsx';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reportar" element={<PublicTicketForm />} />
      <Route path="/chat" element={<PublicChatWidget />} />
      {/* Landing unificada: compone /reportar y /chat + el bot del árbol de
          decisiones (ver features/chatbot) — ambas rutas de abajo siguen
          funcionando solas para quien ya tenga el link directo. */}
      <Route path="/soporte" element={<SupportLandingPage />} />
      <Route path="/terminos" element={<TermsPage />} />
      <Route path="/privacidad" element={<PrivacyPage />} />
      {/* Decide según sesión: sin login, home pública; con sesión, el mismo
          dashboard de siempre dentro de AppLayout — ver RootRoute.tsx. */}
      <Route path="/" element={<RootRoute />} />
      {/* Preview de diseño con datos mock, sin login — ver
          features/messenger/. Sacar esta ruta (o ponerle un guard) cuando
          se conecte a datos reales. */}
      <Route path="/messenger-demo" element={<MessengerLayout />} />
      <Route path="/quotes/approve/:token" element={<PublicQuoteApproval />} />
      <Route
        path="/tickets/:id/report"
        element={
          <ProtectedRoute>
            <TicketReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/devices/:id/report"
        element={
          <ProtectedRoute>
            <StaffRoute>
              <DeviceReport />
            </StaffRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory/:id/report"
        element={
          <ProtectedRoute>
            <StaffRoute permission="inventory:view">
              <InventoryReport />
            </StaffRoute>
          </ProtectedRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/tickets" element={<TicketList />} />
        <Route path="/tickets/:id" element={<TicketDetail />} />
        <Route path="/account/security" element={<SecurityPage />} />
        <Route path="/activities" element={<ActivityList />} />
        <Route path="/activities/:id" element={<ActivityDetail />} />
        <Route
          path="/inbox"
          element={
            <StaffRoute>
              <MessagesPage />
            </StaffRoute>
          }
        />
        <Route
          path="/inbox/settings"
          element={
            <AdminRoute>
              <ChannelsSettingsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/devices"
          element={
            <StaffRoute>
              <DeviceList />
            </StaffRoute>
          }
        />
        <Route
          path="/devices/:id"
          element={
            <StaffRoute>
              <DeviceDetail />
            </StaffRoute>
          }
        />
        <Route
          path="/remote-connect"
          element={
            <StaffRoute permission="devices:remote-connect">
              <RemoteConnectPage />
            </StaffRoute>
          }
        />
        <Route
          path="/approvals"
          element={
            <ClienteRoute permission="quotes:approve">
              <PendingApprovalsPage />
            </ClienteRoute>
          }
        />
        <Route
          path="/quotes"
          element={
            <StaffRoute permission="quotes:manage">
              <QuoteList />
            </StaffRoute>
          }
        />
        <Route
          path="/quotes/:id"
          element={
            <StaffRoute permission="quotes:manage">
              <QuoteDetail />
            </StaffRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <StaffRoute permission="inventory:view">
              <InventoryList />
            </StaffRoute>
          }
        />
        <Route
          path="/inventory/:id"
          element={
            <StaffRoute permission="inventory:view">
              <InventoryDetail />
            </StaffRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <AdminRoute>
              <SettingsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/companies"
          element={
            <AdminRoute>
              <CompaniesPage />
            </AdminRoute>
          }
        />
        <Route
          path="/users"
          element={
            <AdminRoute>
              <UsersPage />
            </AdminRoute>
          }
        />
        <Route
          path="/agents"
          element={
            <AdminRoute>
              <AgentsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/logs"
          element={
            <AdminRoute>
              <LogsPage />
            </AdminRoute>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
