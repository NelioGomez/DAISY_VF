-- =====================================================================
-- SIVEN · Proveedores por producto a partir de las entradas ya registradas
--
-- Solo datos: no cambia el esquema. Las entradas cargadas DESPUÉS de la migración
-- 20261027040000 (por ejemplo con scripts/seed-demo.mjs) no llenaron product_suppliers,
-- y el panel de reabastecimiento lo usa para proponer a quién comprar. Desde esta versión
-- la API lo mantiene sola (recepciones de compra y entradas manuales con proveedor).
--
-- Idempotente: no duplica filas ni cambia un proveedor preferente ya definido.
-- =====================================================================

BEGIN;

-- Último costo de cada proveedor por producto (en C$: las entradas manuales son en córdobas).
INSERT INTO "product_suppliers" ("product_id", "supplier_id", "last_cost", "currency", "is_preferred", "created_at", "updated_at")
SELECT DISTINCT ON (m."product_id", m."supplier_id")
       m."product_id", m."supplier_id", m."unit_cost", 'NIO', false, m."created_at", m."created_at"
  FROM "inventory_movements" m
 WHERE m."type" = 'ENTRY' AND m."supplier_id" IS NOT NULL
 ORDER BY m."product_id", m."supplier_id", m."created_at" DESC
ON CONFLICT ("product_id", "supplier_id") DO NOTHING;

-- Preferente = el de la entrada más reciente, solo si el producto todavía no tiene uno.
UPDATE "product_suppliers" ps
   SET "is_preferred" = true
  FROM (SELECT DISTINCT ON ("product_id") "product_id", "supplier_id"
          FROM "inventory_movements"
         WHERE "type" = 'ENTRY' AND "supplier_id" IS NOT NULL
         ORDER BY "product_id", "created_at" DESC) ultimo
 WHERE ps."product_id" = ultimo."product_id"
   AND ps."supplier_id" = ultimo."supplier_id"
   AND NOT EXISTS (SELECT 1 FROM "product_suppliers" x WHERE x."product_id" = ps."product_id" AND x."is_preferred");

COMMIT;
