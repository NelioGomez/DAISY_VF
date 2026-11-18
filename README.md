<div align="center">

# ⛽ SIVEN

### Sistema de Inventario y Ventas · NORCOR Fueling System

*Del pedido al proveedor a la factura del cliente: toda la operación en un solo lugar.*

![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)

</div>

---

## ¿Qué es SIVEN?

**NORCOR Fueling System** vende repuestos, equipos y servicio técnico para estaciones de servicio en Nicaragua. **SIVEN** es su sistema de gestión, y conecta lo que antes vivía en hojas de cálculo, cuadernos y mensajes sueltos.

Cada documento nace del anterior, así que nada se digita dos veces:

> **Solicitud web** → **Cotización** → **Factura** → **Pago**
>
> **Pedido de compra** → **Recepción** → **Inventario** → **Venta**
>
> **Orden de producción** → **Lote** → **Control de calidad** → **Inventario**

Todo queda a nombre de quien lo hizo y se actualiza **en tiempo real** para cada usuario conectado.

## Tres caras, una sola fuente de verdad

| | | |
|:---:|:---:|:---:|
| 🏢 **Sistema interno** | 🌐 **Sitio web público** | 👤 **Portal de clientes** |
| El personal compra, controla el inventario, cotiza, vende, cobra, produce y atiende servicio técnico. | Cualquier persona ve el catálogo con precios, compara productos y arma su lista de cotización. | Los clientes envían su lista y siguen sus solicitudes y cotizaciones en línea. |

## Lo que hace

- 📦 **Compras e inventario**: reabastecimiento sugerido, recepciones parciales, costo promedio, bodega y sucursal, traslados y ajustes.
- 🧾 **Ventas**: cotizaciones con pipeline, punto de venta con lector de código de barras, contado, transferencia o crédito.
- 💰 **Cuentas por cobrar**: abonos, vencimientos y antigüedad de saldos.
- 🏭 **Producción**: listas de materiales, rutas, órdenes, lotes y control de calidad.
- 🔧 **Servicio técnico (OPI)**: órdenes asignadas a técnicos, con garantía de producto y de trabajo.
- 📊 **Dashboard y reportes**: indicadores, pendientes del día y exportación a Excel.
- 🛡️ **Seguridad**: seis roles con permisos por acción y una auditoría de solo lectura.
- 📖 **Manual de usuario** integrado, con búsqueda, capturas y descarga en PDF.

## Tecnologías

| Capa | Herramientas |
|---|---|
| **Backend (API)** | NestJS · Prisma · PostgreSQL · Passport + JWT · Socket.IO · Swagger · class-validator · Nodemailer · Jest |
| **Frontend** | React · React Router · Vite · TypeScript · Socket.IO Client · pdfmake · Oxlint |
| **Base de datos** | PostgreSQL 16 con migraciones SQL y Prisma como ORM |

## Estructura

```
DAISY-main/
├── backend/    API REST + WebSocket (NestJS)
└── frontend/   Sistema interno, sitio público y portal (React)
```

---

<div align="center">

Proyecto de **Diseño de Sistemas de Internet** · Universidad Nacional de Ingeniería · 2026

</div>
