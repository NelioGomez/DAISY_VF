/* Rutas de la aplicación.
   /login       → acceso interno
   /recuperar   → recuperación de contraseña en 3 pasos
   /catalogo    → sitio público (sin sesión)
   /app/:módulo → panel interno protegido por sesión y rol */
import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../../features/auth/LoginPage';
import { RecoverPage } from '../../features/auth/recover/RecoverPage';
import { AuditPage } from '../../features/audit/AuditPage';
import { CatalogInternalPage } from '../../features/catalog/CatalogInternalPage';
import { PublicCatalogPage } from '../../features/catalog/PublicCatalogPage';
import { CustomersPage } from '../../features/customers/CustomersPage';
import { DashboardPage } from '../../features/dashboard/DashboardPage';
import { InventoryPage } from '../../features/inventory/InventoryPage';
import { PaymentsPage } from '../../features/payments/PaymentsPage';
import { ProductsPage } from '../../features/products/ProductsPage';
import { PurchasesPage } from '../../features/purchases/PurchasesPage';
import { QuotationsPage } from '../../features/quotations/QuotationsPage';
import { ReportsPage } from '../../features/reports/ReportsPage';
import { SalesPage } from '../../features/sales/SalesPage';
import { ServiceOrdersPage } from '../../features/service-orders/ServiceOrdersPage';
import { SuppliersPage } from '../../features/suppliers/SuppliersPage';
import { WebInquiriesPage } from '../../features/web-inquiries/WebInquiriesPage';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import type { ModuleId } from '../../types';
import { HomeRedirect, RequireAuth, RequireModule } from './guards';

/** Cada módulo del menú y la página que lo implementa. */
const MODULE_PAGES: Record<ModuleId, ReactElement> = {
  dashboard: <DashboardPage />,
  productos: <ProductsPage />,
  inventario: <InventoryPage />,
  compras: <PurchasesPage />,
  clientes: <CustomersPage />,
  proveedores: <SuppliersPage />,
  cotizaciones: <QuotationsPage />,
  ventas: <SalesPage />,
  pagos: <PaymentsPage />,
  ordenes: <ServiceOrdersPage />,
  reportes: <ReportsPage />,
  catalogo: <CatalogInternalPage />,
  consultas: <WebInquiriesPage />,
  auditoria: <AuditPage />,
};

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/recuperar" element={<RecoverPage />} />
      <Route path="/catalogo" element={<PublicCatalogPage />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<HomeRedirect />} />
        {(Object.keys(MODULE_PAGES) as ModuleId[]).map((id) => (
          <Route key={id} path={id} element={<RequireModule id={id}>{MODULE_PAGES[id]}</RequireModule>} />
        ))}
        <Route path="*" element={<HomeRedirect />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
