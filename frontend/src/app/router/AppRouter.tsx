/* Rutas de la aplicación.
   /                    → sitio público: Inicio, /catalogo, /catalogo/:id, /nosotros, /contacto
   /clientes/...        → acceso y portal de clientes (sesión propia, separada del personal)
   /login, /recuperar   → acceso interno del personal
   /app/:módulo         → panel interno protegido por sesión y rol */
import { lazy, Suspense, type ComponentType, type ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { FullScreenLoader } from '../../components/feedback/FullScreenLoader';
import { CustomerLoginPage } from '../../features/portal/CustomerLoginPage';
import { CustomerRegisterPage } from '../../features/portal/CustomerRegisterPage';
import { MyInquiriesPage } from '../../features/portal/MyInquiriesPage';
import { MyProfilePage } from '../../features/portal/MyProfilePage';
import { MyQuotationsPage } from '../../features/portal/MyQuotationsPage';
import { PortalLayout } from '../../features/portal/PortalLayout';
import { QuotationDetailPage } from '../../features/portal/QuotationDetailPage';
import { RequireCustomer } from '../../features/portal/RequireCustomer';
import { AboutPage } from '../../features/public/AboutPage';
import { CatalogPage } from '../../features/public/CatalogPage';
import { ContactPage } from '../../features/public/ContactPage';
import { HomePage } from '../../features/public/HomePage';
import { NotFoundPage } from '../../features/public/NotFoundPage';
import { ProductPage } from '../../features/public/ProductPage';
import { PublicLayout } from '../../features/public/PublicLayout';
import type { ModuleId } from '../../types';
import { HomeRedirect, RequireAuth, RequireModule } from './guards';

/* El sitio público va en el paquete inicial; el sistema interno se descarga solo
   cuando alguien del personal entra (cada módulo por separado). */
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

const LoginPage = page(() => import('../../features/auth/LoginPage'), 'LoginPage');
const RecoverPage = page(() => import('../../features/auth/recover/RecoverPage'), 'RecoverPage');
const DashboardLayout = page(() => import('../../layouts/DashboardLayout'), 'DashboardLayout');
const DashboardPage = page(() => import('../../features/dashboard/DashboardPage'), 'DashboardPage');
const ProductsPage = page(() => import('../../features/products/ProductsPage'), 'ProductsPage');
const InventoryPage = page(() => import('../../features/inventory/InventoryPage'), 'InventoryPage');
const PurchasesPage = page(() => import('../../features/purchases/PurchasesPage'), 'PurchasesPage');
const ProductionPage = page(() => import('../../features/production/ProductionPage'), 'ProductionPage');
const CustomersPage = page(() => import('../../features/customers/CustomersPage'), 'CustomersPage');
const SuppliersPage = page(() => import('../../features/suppliers/SuppliersPage'), 'SuppliersPage');
const QuotationsPage = page(() => import('../../features/quotations/QuotationsPage'), 'QuotationsPage');
const SalesPage = page(() => import('../../features/sales/SalesPage'), 'SalesPage');
const PosPage = page(() => import('../../features/sales/PosPage'), 'PosPage');
const PaymentsPage = page(() => import('../../features/payments/PaymentsPage'), 'PaymentsPage');
const ServiceOrdersPage = page(() => import('../../features/service-orders/ServiceOrdersPage'), 'ServiceOrdersPage');
const ReportsPage = page(() => import('../../features/reports/ReportsPage'), 'ReportsPage');
const CatalogInternalPage = page(() => import('../../features/catalog/CatalogInternalPage'), 'CatalogInternalPage');
const WebInquiriesPage = page(() => import('../../features/web-inquiries/WebInquiriesPage'), 'WebInquiriesPage');
const AuditPage = page(() => import('../../features/audit/AuditPage'), 'AuditPage');

const staff = (el: ReactElement) => <Suspense fallback={<FullScreenLoader text="Cargando SIVEN…" />}>{el}</Suspense>;

/** Cada módulo del menú y la página que lo implementa. */
const MODULE_PAGES: Record<ModuleId, ReactElement> = {
  dashboard: <DashboardPage />,
  productos: <ProductsPage />,
  inventario: <InventoryPage />,
  compras: <PurchasesPage />,
  produccion: <ProductionPage />,
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
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="catalogo" element={<CatalogPage />} />
        <Route path="catalogo/:id" element={<ProductPage />} />
        <Route path="nosotros" element={<AboutPage />} />
        <Route path="contacto" element={<ContactPage />} />
        <Route path="clientes/ingresar" element={<CustomerLoginPage />} />
        <Route path="clientes/registro" element={<CustomerRegisterPage />} />
        <Route
          path="clientes/cuenta"
          element={
            <RequireCustomer>
              <PortalLayout />
            </RequireCustomer>
          }
        >
          <Route index element={<Navigate to="solicitudes" replace />} />
          <Route path="solicitudes" element={<MyInquiriesPage />} />
          <Route path="cotizaciones" element={<MyQuotationsPage />} />
          <Route path="cotizaciones/:id" element={<QuotationDetailPage />} />
          <Route path="perfil" element={<MyProfilePage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="/login" element={staff(<LoginPage />)} />
      <Route path="/recuperar" element={staff(<RecoverPage />)} />
      <Route path="/app" element={staff(<RequireAuth>{<DashboardLayout />}</RequireAuth>)}>
        <Route index element={<HomeRedirect />} />
        {(Object.keys(MODULE_PAGES) as ModuleId[]).map((id) => (
          <Route key={id} path={id} element={<RequireModule id={id}>{MODULE_PAGES[id]}</RequireModule>} />
        ))}
        {/* Venta tipo POS: pantalla propia dentro del módulo Ventas. */}
        <Route
          path="ventas/nueva"
          element={
            <RequireModule id="ventas">
              <PosPage />
            </RequireModule>
          }
        />
        <Route path="*" element={<HomeRedirect />} />
      </Route>
    </Routes>
  );
}
