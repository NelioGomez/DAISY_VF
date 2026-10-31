/**
 * Ubicaciones fijas de NORCOR (creadas por la migración 20261027040000_mejoras_base_de_datos).
 * products.stock es el total; product_stocks lo reparte entre estas dos ubicaciones
 * (migración 20261101000000_existencias_por_ubicacion).
 */
export const MAIN_WAREHOUSE_ID = 1; // BOD · Bodega principal: recepciones, producción y ajustes
export const BRANCH_ID = 2; // SUC · Sucursal principal: punto de venta

export const LOCATION_IDS = [MAIN_WAREHOUSE_ID, BRANCH_ID] as const;

export const LOCATION_NAME: Record<number, string> = {
  [MAIN_WAREHOUSE_ID]: 'Bodega principal',
  [BRANCH_ID]: 'Sucursal principal',
};

/** Orden en que se descarga una venta: primero la sucursal y, si no alcanza, la bodega. */
export const SALE_SOURCES = [BRANCH_ID, MAIN_WAREHOUSE_ID];
/** Orden en que producción toma materiales: primero la bodega y luego la sucursal. */
export const PRODUCTION_SOURCES = [MAIN_WAREHOUSE_ID, BRANCH_ID];
