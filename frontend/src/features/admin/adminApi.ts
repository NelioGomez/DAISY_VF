/* Llamadas del panel de administración (mejora n.° 66). Usa los mismos endpoints del backend que ya
   existían (usuarios, roles, categorías, marcas, clientes, proveedores y configuración); todos piden
   permisos de administrador y quedan en la auditoría. */
import { api, getAll } from '../../services/api/client';
import type { ApiRole } from '../../services/api/mappers';

export interface UsuarioAdmin {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  role: { id: string; code: ApiRole; name: string };
}

export interface RolAdmin {
  id: string;
  code: ApiRole;
  name: string;
  description: string | null;
  permissions: string[];
}

export interface CatalogoAdmin {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  productCount: number;
}

export interface SocioAdmin {
  id: string;
  name: string;
  ruc?: string | null;
  taxId?: string | null;
  country?: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
}

export interface Configuracion {
  taxRate: number;
  taxRegime: 'CUOTA_FIJA' | 'IVA';
  creditTermDays: number;
  company: { name: string; phone: string; email: string; whatsapp: string; address: string; hours: string };
}

export type TipoCatalogo = 'categories' | 'brands';
export type TipoSocio = 'customers' | 'suppliers';

export interface DatosUsuario {
  firstName: string;
  lastName: string;
  email: string;
  role: ApiRole;
}

export const adminApi = {
  usuarios: () => getAll<UsuarioAdmin>('/users').then((r) => r.items),
  crearUsuario: (d: DatosUsuario & { username: string; password: string }) => api.post<UsuarioAdmin>('/users', d),
  editarUsuario: (id: string, d: Partial<DatosUsuario>) => api.patch<UsuarioAdmin>(`/users/${id}`, d),
  estadoUsuario: (id: string, isActive: boolean) => api.patch<UsuarioAdmin>(`/users/${id}/status`, { isActive }),
  restablecer: (id: string, newPassword: string) => api.post<{ passwordReset: boolean }>(`/users/${id}/reset-password`, { newPassword }),

  roles: () => api.get<RolAdmin[]>('/roles'),

  catalogo: (tipo: TipoCatalogo) => getAll<CatalogoAdmin>(`/${tipo}`).then((r) => r.items),
  crearCatalogo: (tipo: TipoCatalogo, d: { name: string; description?: string }) => api.post<CatalogoAdmin>(`/${tipo}`, d),
  editarCatalogo: (tipo: TipoCatalogo, id: string, d: { name: string; description?: string }) => api.patch<CatalogoAdmin>(`/${tipo}/${id}`, d),
  estadoCatalogo: (tipo: TipoCatalogo, id: string, isActive: boolean) => api.patch<CatalogoAdmin>(`/${tipo}/${id}/status`, { isActive }),
  eliminarCatalogo: (tipo: TipoCatalogo, id: string) => api.del<void>(`/${tipo}/${id}`),

  socios: (tipo: TipoSocio) => getAll<SocioAdmin>(`/${tipo}`).then((r) => r.items),
  estadoSocio: (tipo: TipoSocio, id: string, isActive: boolean) => api.patch<SocioAdmin>(`/${tipo}/${id}/status`, { isActive }),

  configuracion: () => api.get<Configuracion>('/settings'),
  guardarConfiguracion: (values: Record<string, string>) => api.patch<Configuracion>('/settings', { values }),
};

/** Contraseña temporal que cumple la política (12 caracteres con mayúsculas, minúsculas, números y símbolos). */
export function generarContrasena(): string {
  const grupos = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '#$!?@%*+'];
  const todos = grupos.join('');
  const azar = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const chars = grupos.map((g) => g[azar(g.length)]);
  while (chars.length < 12) chars.push(todos[azar(todos.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = azar(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
