-- =====================================================================
-- SIVEN · Mejoras de la base de datos
--
-- Origen: Análisis de mejoras (P0–P3) y Prompt Maestro (PK, FK, UNIQUE, NOT NULL, CHECK,
-- índices). Generada con el motor de migraciones de Prisma 7.10 y completada a mano donde
-- el SQL automático perdería datos (ver docs/base-de-datos.md, sección "Migración").
--
-- Todo va en UNA transacción: si algo falla, la base queda exactamente como estaba.
-- Requiere PostgreSQL 13 o superior.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Requisitos y verificaciones previas (mensajes claros antes de tocar nada)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  dup text;
BEGIN
  IF current_setting('server_version_num')::int < 130000 THEN
    RAISE EXCEPTION 'SIVEN requiere PostgreSQL 13 o superior (versión actual: %)', current_setting('server_version');
  END IF;

  SELECT string_agg(e, ', ') INTO dup FROM (
    SELECT lower(btrim(email)) AS e FROM users GROUP BY 1 HAVING count(*) > 1) d;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION 'Hay usuarios con el mismo correo (sin distinguir mayúsculas): %. Corríjalos antes de migrar.', dup;
  END IF;

  SELECT string_agg(u, ', ') INTO dup FROM (
    SELECT lower(btrim(username)) AS u FROM users GROUP BY 1 HAVING count(*) > 1) d;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION 'Hay usuarios con el mismo nombre de usuario (sin distinguir mayúsculas): %. Corríjalos antes de migrar.', dup;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1. Tipos enumerados
-- ---------------------------------------------------------------------
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
CREATE TYPE "UnitOfMeasure" AS ENUM ('UNIT', 'PAIR', 'SET', 'KIT', 'BOX', 'METER', 'LITER', 'GALLON');
CREATE TYPE "LocationType" AS ENUM ('WAREHOUSE', 'BRANCH');
CREATE TYPE "Currency" AS ENUM ('NIO', 'USD');

-- Solicitudes web: ATTENDED pasa a llamarse IN_REVIEW (se conservan las filas existentes)
-- y se agregan QUOTED y CANCELLED en el orden del esquema.
ALTER TYPE "InquiryStatus" RENAME VALUE 'ATTENDED' TO 'IN_REVIEW';
ALTER TYPE "InquiryStatus" ADD VALUE 'QUOTED' BEFORE 'CLOSED';
ALTER TYPE "InquiryStatus" ADD VALUE 'CANCELLED' AFTER 'CLOSED';

-- ---------------------------------------------------------------------
-- 2. Llaves foráneas e índices que se reemplazan más abajo
-- ---------------------------------------------------------------------
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_permissionId_fkey";
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_roleId_fkey";
ALTER TABLE "service_orders" DROP CONSTRAINT "service_orders_sale_id_fkey";
ALTER TABLE "service_orders" DROP CONSTRAINT "service_orders_technician_id_fkey";
DROP INDEX "inventory_movements_source_entity_source_id_idx";
DROP INDEX "quotation_items_quotation_id_idx";
DROP INDEX "quotations_status_idx";
DROP INDEX "sale_items_sale_id_idx";

-- ---------------------------------------------------------------------
-- 3. role_permissions: columnas a snake_case SIN perder los permisos asignados
--    (el SQL automático borraba las columnas y las creaba vacías)
-- ---------------------------------------------------------------------
ALTER TABLE "role_permissions" RENAME COLUMN "roleId" TO "role_id";
ALTER TABLE "role_permissions" RENAME COLUMN "permissionId" TO "permission_id";

-- ---------------------------------------------------------------------
-- 4. Fechas a TIMESTAMPTZ(3). Los valores guardados son hora UTC sin zona; se indica
--    explícitamente para que el resultado no dependa de la zona horaria del servidor.
-- ---------------------------------------------------------------------
ALTER TABLE "audit_logs" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "customers" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "customers" ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "inventory_movements" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "payments" ALTER COLUMN "paid_at" SET DATA TYPE TIMESTAMPTZ(3) USING "paid_at" AT TIME ZONE 'UTC';
ALTER TABLE "products" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "products" ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "quotations" ALTER COLUMN "issued_at" SET DATA TYPE TIMESTAMPTZ(3) USING "issued_at" AT TIME ZONE 'UTC';
ALTER TABLE "quotations" ALTER COLUMN "valid_until" SET DATA TYPE TIMESTAMPTZ(3) USING "valid_until" AT TIME ZONE 'UTC';
ALTER TABLE "quotations" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "quotations" ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "sales" ALTER COLUMN "sold_at" SET DATA TYPE TIMESTAMPTZ(3) USING "sold_at" AT TIME ZONE 'UTC';
ALTER TABLE "sales" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "sales" ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "sales" ALTER COLUMN "due_date" SET DATA TYPE TIMESTAMPTZ(3) USING "due_date" AT TIME ZONE 'UTC';
ALTER TABLE "sales" ALTER COLUMN "voided_at" SET DATA TYPE TIMESTAMPTZ(3) USING "voided_at" AT TIME ZONE 'UTC';
ALTER TABLE "service_orders" ALTER COLUMN "registered_at" SET DATA TYPE TIMESTAMPTZ(3) USING "registered_at" AT TIME ZONE 'UTC';
ALTER TABLE "service_orders" ALTER COLUMN "started_at" SET DATA TYPE TIMESTAMPTZ(3) USING "started_at" AT TIME ZONE 'UTC';
ALTER TABLE "service_orders" ALTER COLUMN "finished_at" SET DATA TYPE TIMESTAMPTZ(3) USING "finished_at" AT TIME ZONE 'UTC';
ALTER TABLE "service_orders" ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "suppliers" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "suppliers" ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "system_config" ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "users" ALTER COLUMN "last_login_at" SET DATA TYPE TIMESTAMPTZ(3) USING "last_login_at" AT TIME ZONE 'UTC';
ALTER TABLE "web_inquiries" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

-- ---------------------------------------------------------------------
-- 5. Columnas nuevas en tablas existentes
-- ---------------------------------------------------------------------
ALTER TABLE "users"
  ADD COLUMN "password_changed_at" TIMESTAMPTZ(3);

ALTER TABLE "products"
  ADD COLUMN "barcode" VARCHAR(64),
  ADD COLUMN "image_url" VARCHAR(500),
  ADD COLUMN "max_stock" INTEGER,
  ADD COLUMN "restock_postponed_until" TIMESTAMPTZ(3),
  ADD COLUMN "unit" "UnitOfMeasure" NOT NULL DEFAULT 'UNIT';

ALTER TABLE "inventory_movements"
  ADD COLUMN "location_id" SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN "purchase_receipt_item_id" UUID,
  ADD COLUMN "sale_id" UUID;

ALTER TABLE "quotations"
  ADD COLUMN "inquiry_id" UUID,
  ADD COLUMN "rejection_reason" VARCHAR(500),
  ADD COLUMN "status_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0;

ALTER TABLE "sales"
  ADD COLUMN "location_id" SMALLINT NOT NULL DEFAULT 2,
  ADD COLUMN "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0;

ALTER TABLE "service_orders"
  ADD COLUMN "cancellation_reason" VARCHAR(500),
  ADD COLUMN "cancelled_at" TIMESTAMPTZ(3);

ALTER TABLE "web_inquiries"
  ADD COLUMN "assigned_to_id" UUID,
  ADD COLUMN "code" VARCHAR(30),
  ADD COLUMN "customer_account_id" UUID,
  ADD COLUMN "customer_id" UUID,
  ADD COLUMN "status_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMPTZ(3);

ALTER TABLE "system_config"
  ADD COLUMN "updated_by_id" UUID;

-- ---------------------------------------------------------------------
-- 6. Tablas nuevas
-- ---------------------------------------------------------------------
CREATE TABLE "password_reset_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "customer_account_id" UUID,
    "sent_to" VARCHAR(150) NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "request_ip" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "code_id" UUID NOT NULL,
    "user_id" UUID,
    "customer_account_id" UUID,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "locations" (
    "id" SMALLSERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "LocationType" NOT NULL,
    "address" VARCHAR(255),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_prices" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "valid_from" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMPTZ(3),
    "changed_by_id" UUID,
    "reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_prices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_suppliers" (
    "product_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "supplier_sku" VARCHAR(60),
    "last_cost" DECIMAL(14,4),
    "currency" "Currency" NOT NULL DEFAULT 'NIO',
    "lead_time_days" SMALLINT,
    "is_preferred" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_suppliers_pkey" PRIMARY KEY ("product_id","supplier_id")
);

CREATE TABLE "customer_accounts" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "contact_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(40),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "email_verified_at" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "password_changed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchases" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" "Currency" NOT NULL DEFAULT 'NIO',
    "exchange_rate" DECIMAL(12,6) NOT NULL DEFAULT 1,
    "ordered_at" TIMESTAMPTZ(3),
    "expected_at" TIMESTAMPTZ(3),
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "additional_costs" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" VARCHAR(1000),
    "created_by_id" UUID NOT NULL,
    "cancelled_at" TIMESTAMPTZ(3),
    "cancellation_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_items" (
    "id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(14,4) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "received_quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_receipts" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "purchase_id" UUID NOT NULL,
    "location_id" SMALLINT NOT NULL DEFAULT 1,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by_id" UUID NOT NULL,
    "notes" VARCHAR(500),

    CONSTRAINT "purchase_receipts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_receipt_items" (
    "id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "purchase_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "purchase_receipt_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "web_inquiry_items" (
    "id" UUID NOT NULL,
    "inquiry_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" VARCHAR(255),

    CONSTRAINT "web_inquiry_items_pkey" PRIMARY KEY ("id")
);

-- Ubicaciones fijas de la operación (los movimientos y ventas existentes las referencian).
INSERT INTO "locations" ("id", "code", "name", "type", "is_default") VALUES
  (1, 'BOD', 'Bodega principal', 'WAREHOUSE', true),
  (2, 'SUC', 'Sucursal', 'BRANCH', true);
DO $$ BEGIN PERFORM setval(pg_get_serial_sequence('"locations"', 'id'), 2); END $$;

-- ---------------------------------------------------------------------
-- 7. Migración de los datos existentes
-- ---------------------------------------------------------------------

-- 7.1 Usuario y correo en minúsculas (el login no distingue mayúsculas).
UPDATE "users" SET "username" = lower(btrim("username")), "email" = lower(btrim("email"))
 WHERE "username" <> lower(btrim("username")) OR "email" <> lower(btrim("email"));
UPDATE "customers" SET "email" = NULLIF(lower(btrim("email")), '') WHERE "email" IS NOT NULL;
UPDATE "suppliers" SET "email" = NULLIF(lower(btrim("email")), '') WHERE "email" IS NOT NULL;

-- 7.2 Origen de los movimientos: de (source_entity, source_id) a una FK real hacia la venta.
UPDATE "inventory_movements" m
   SET "sale_id" = m."source_id"
 WHERE m."source_entity" IN ('Sale', 'SaleVoid')
   AND EXISTS (SELECT 1 FROM "sales" s WHERE s."id" = m."source_id");

DO $$
DECLARE
  huerfanos int;
BEGIN
  SELECT count(*) INTO huerfanos FROM "inventory_movements"
   WHERE "source_entity" IS NOT NULL AND "sale_id" IS NULL;
  IF huerfanos > 0 THEN
    RAISE EXCEPTION '% movimiento(s) tienen un origen que no corresponde a una venta existente; revíselos antes de migrar.', huerfanos;
  END IF;
END $$;

ALTER TABLE "inventory_movements" DROP COLUMN "source_entity", DROP COLUMN "source_id";

-- 7.3 Solicitudes web: código correlativo (SOL-000001…) por fecha de llegada.
WITH numeradas AS (
  SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS n FROM "web_inquiries"
)
UPDATE "web_inquiries" w
   SET "code" = 'SOL-' || lpad(numeradas.n::text, 6, '0'),
       "updated_at" = w."created_at",
       "status_changed_at" = w."created_at"
  FROM numeradas
 WHERE w."id" = numeradas."id";
ALTER TABLE "web_inquiries" ALTER COLUMN "code" SET NOT NULL, ALTER COLUMN "updated_at" SET NOT NULL;

INSERT INTO "document_sequences" ("key", "last_value")
SELECT 'INQUIRY', count(*) FROM "web_inquiries"
ON CONFLICT ("key") DO UPDATE SET "last_value" = GREATEST("document_sequences"."last_value", EXCLUDED."last_value");

-- 7.4 Tasa de impuesto con que se emitió cada documento (antes solo quedaba el monto).
UPDATE "quotations" SET "tax_rate" = CASE WHEN "subtotal" > 0 THEN round("tax" / "subtotal", 4) ELSE 0 END,
                        "status_changed_at" = "updated_at";
UPDATE "sales" SET "tax_rate" = CASE WHEN "subtotal" > 0 THEN round("tax" / "subtotal", 4) ELSE 0 END;

-- 7.5 Ventas: punto de venta = sucursal; sus movimientos de inventario, en la misma ubicación.
UPDATE "inventory_movements" m SET "location_id" = s."location_id"
  FROM "sales" s WHERE m."sale_id" = s."id";

-- 7.6 Órdenes canceladas: fecha y motivo en columnas propias (antes iban dentro de notes).
UPDATE "service_orders"
   SET "cancelled_at" = "updated_at",
       "cancellation_reason" = COALESCE(
         (regexp_match("notes", 'Cancelada: ([^\n]+)\s*$'))[1],
         'Motivo no registrado (migración)')
 WHERE "status" = 'CANCELLED';

-- 7.7 Historial de precios: el precio vigente de cada producto abre su historial.
INSERT INTO "product_prices" ("id", "product_id", "price", "valid_from", "reason", "created_at")
SELECT gen_random_uuid(), p."id", p."sale_price", p."created_at", 'Precio vigente al migrar', now()
  FROM "products" p
 WHERE p."sale_price" > 0;

-- 7.8 Proveedores por producto, deducidos de las entradas ya registradas
--     (último costo de cada proveedor; preferente = el de la entrada más reciente).
INSERT INTO "product_suppliers" ("product_id", "supplier_id", "last_cost", "currency", "is_preferred", "created_at", "updated_at")
SELECT DISTINCT ON (m."product_id", m."supplier_id")
       m."product_id", m."supplier_id", m."unit_cost", 'NIO', false, m."created_at", m."created_at"
  FROM "inventory_movements" m
 WHERE m."type" = 'ENTRY' AND m."supplier_id" IS NOT NULL
 ORDER BY m."product_id", m."supplier_id", m."created_at" DESC;

UPDATE "product_suppliers" ps SET "is_preferred" = true
  FROM (SELECT DISTINCT ON ("product_id") "product_id", "supplier_id"
          FROM "inventory_movements"
         WHERE "type" = 'ENTRY' AND "supplier_id" IS NOT NULL
         ORDER BY "product_id", "created_at" DESC) ultimo
 WHERE ps."product_id" = ultimo."product_id" AND ps."supplier_id" = ultimo."supplier_id";

-- 7.9 Configuración. Régimen de cuota fija: sin IVA por defecto (P0 del análisis de mejoras).
--     Si alguien ya cambió la tasa a mano, se respeta; solo se reemplaza el 0.15 inicial.
UPDATE "system_config" SET "value" = '0', "description" = 'Tasa de impuesto (0 = cuota fija, sin IVA)'
 WHERE "key" = 'TAX_RATE' AND "value" = '0.15';
INSERT INTO "system_config" ("key", "value", "description", "updated_at") VALUES
  ('TAX_RATE', '0', 'Tasa de impuesto (0 = cuota fija, sin IVA)', now()),
  ('TAX_REGIME', 'CUOTA_FIJA', 'Régimen fiscal: CUOTA_FIJA o IVA', now()),
  ('CREDIT_TERM_DAYS', '15', 'Plazo de crédito por defecto (días)', now()),
  ('COMPANY_NAME', 'NORCOR FUELING SYSTEM', 'Nombre comercial', now()),
  ('COMPANY_PHONE', '', 'Teléfono de contacto (sitio público)', now()),
  ('COMPANY_EMAIL', '', 'Correo de contacto (sitio público)', now()),
  ('COMPANY_WHATSAPP', '', 'WhatsApp (sitio público)', now()),
  ('COMPANY_ADDRESS', '', 'Dirección (sitio público)', now())
ON CONFLICT ("key") DO NOTHING;

-- 7.10 Permisos de los módulos nuevos, con la misma matriz que prisma/seed.ts. Así una base
--      existente queda lista aunque no se vuelva a ejecutar el seed (en una base nueva, el seed
--      crea los roles y asigna estos permisos después).
INSERT INTO "permissions" ("id", "code", "description")
SELECT gen_random_uuid(), c, d FROM (VALUES
  ('purchases:read',  'Consultar compras y recepciones'),
  ('purchases:write', 'Registrar compras y recepciones'),
  ('prices:read',     'Consultar precios e historial'),
  ('prices:write',    'Fijar el precio comercial'),
  ('settings:read',   'Consultar la configuración'),
  ('settings:write',  'Cambiar la configuración')) AS v(c, d)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
  FROM (VALUES
    ('ADMIN', 'purchases:read'), ('ADMIN', 'purchases:write'), ('ADMIN', 'prices:read'),
    ('ADMIN', 'prices:write'), ('ADMIN', 'settings:read'), ('ADMIN', 'settings:write'),
    ('MANAGEMENT', 'prices:read'), ('MANAGEMENT', 'prices:write'), ('MANAGEMENT', 'purchases:read'),
    ('SELLER', 'prices:read'),
    ('INVENTORY_MANAGER', 'purchases:read'), ('INVENTORY_MANAGER', 'purchases:write'), ('INVENTORY_MANAGER', 'prices:read'),
    ('ACCOUNTING', 'purchases:read'), ('ACCOUNTING', 'prices:read')) AS m(role_code, perm_code)
  JOIN "roles" r ON r."code"::text = m.role_code
  JOIN "permissions" p ON p."code" = m.perm_code
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 8. Índices
-- ---------------------------------------------------------------------
CREATE INDEX "password_reset_codes_user_id_created_at_idx" ON "password_reset_codes"("user_id", "created_at");
CREATE INDEX "password_reset_codes_customer_account_id_created_at_idx" ON "password_reset_codes"("customer_account_id", "created_at");
CREATE INDEX "password_reset_codes_expires_at_idx" ON "password_reset_codes"("expires_at");
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_code_id_idx" ON "password_reset_tokens"("code_id");
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");
CREATE INDEX "password_reset_tokens_customer_account_id_idx" ON "password_reset_tokens"("customer_account_id");
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");
CREATE UNIQUE INDEX "locations_code_key" ON "locations"("code");
CREATE INDEX "product_prices_product_id_valid_from_idx" ON "product_prices"("product_id", "valid_from" DESC);
CREATE INDEX "product_prices_changed_by_id_idx" ON "product_prices"("changed_by_id");
CREATE INDEX "product_suppliers_supplier_id_idx" ON "product_suppliers"("supplier_id");
CREATE UNIQUE INDEX "customer_accounts_email_key" ON "customer_accounts"("email");
CREATE INDEX "customer_accounts_customer_id_idx" ON "customer_accounts"("customer_id");
CREATE UNIQUE INDEX "purchases_code_key" ON "purchases"("code");
CREATE INDEX "purchases_supplier_id_idx" ON "purchases"("supplier_id");
CREATE INDEX "purchases_status_idx" ON "purchases"("status");
CREATE INDEX "purchases_created_by_id_idx" ON "purchases"("created_by_id");
CREATE INDEX "purchases_created_at_idx" ON "purchases"("created_at");
CREATE INDEX "purchase_items_product_id_idx" ON "purchase_items"("product_id");
CREATE UNIQUE INDEX "purchase_items_purchase_id_product_id_key" ON "purchase_items"("purchase_id", "product_id");
CREATE UNIQUE INDEX "purchase_receipts_code_key" ON "purchase_receipts"("code");
CREATE INDEX "purchase_receipts_purchase_id_idx" ON "purchase_receipts"("purchase_id");
CREATE INDEX "purchase_receipts_received_by_id_idx" ON "purchase_receipts"("received_by_id");
CREATE INDEX "purchase_receipts_received_at_idx" ON "purchase_receipts"("received_at");
CREATE INDEX "purchase_receipt_items_purchase_item_id_idx" ON "purchase_receipt_items"("purchase_item_id");
CREATE UNIQUE INDEX "purchase_receipt_items_receipt_id_purchase_item_id_key" ON "purchase_receipt_items"("receipt_id", "purchase_item_id");
CREATE INDEX "web_inquiry_items_product_id_idx" ON "web_inquiry_items"("product_id");
CREATE UNIQUE INDEX "web_inquiry_items_inquiry_id_product_id_key" ON "web_inquiry_items"("inquiry_id", "product_id");
CREATE INDEX "customers_email_idx" ON "customers"("email");
CREATE UNIQUE INDEX "inventory_movements_purchase_receipt_item_id_key" ON "inventory_movements"("purchase_receipt_item_id");
CREATE INDEX "inventory_movements_created_at_idx" ON "inventory_movements"("created_at");
CREATE INDEX "inventory_movements_user_id_idx" ON "inventory_movements"("user_id");
CREATE INDEX "inventory_movements_supplier_id_idx" ON "inventory_movements"("supplier_id");
CREATE INDEX "inventory_movements_sale_id_idx" ON "inventory_movements"("sale_id");
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");
CREATE UNIQUE INDEX "quotation_items_quotation_id_product_id_key" ON "quotation_items"("quotation_id", "product_id");
CREATE UNIQUE INDEX "quotations_inquiry_id_key" ON "quotations"("inquiry_id");
CREATE INDEX "quotations_seller_id_idx" ON "quotations"("seller_id");
CREATE INDEX "quotations_status_valid_until_idx" ON "quotations"("status", "valid_until");
CREATE INDEX "quotations_issued_at_idx" ON "quotations"("issued_at");
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");
CREATE UNIQUE INDEX "sale_items_sale_id_product_id_key" ON "sale_items"("sale_id", "product_id");
CREATE INDEX "service_orders_sale_id_idx" ON "service_orders"("sale_id");
CREATE INDEX "service_orders_registered_at_idx" ON "service_orders"("registered_at");
CREATE INDEX "system_config_updated_by_id_idx" ON "system_config"("updated_by_id");
CREATE UNIQUE INDEX "web_inquiries_code_key" ON "web_inquiries"("code");
CREATE INDEX "web_inquiries_created_at_idx" ON "web_inquiries"("created_at");
CREATE INDEX "web_inquiries_customer_id_idx" ON "web_inquiries"("customer_id");
CREATE INDEX "web_inquiries_customer_account_id_idx" ON "web_inquiries"("customer_account_id");
CREATE INDEX "web_inquiries_assigned_to_id_idx" ON "web_inquiries"("assigned_to_id");

-- ---------------------------------------------------------------------
-- 9. Llaves foráneas
-- ---------------------------------------------------------------------
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "password_reset_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_purchase_receipt_item_id_fkey" FOREIGN KEY ("purchase_receipt_item_id") REFERENCES "purchase_receipt_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_purchase_item_id_fkey" FOREIGN KEY ("purchase_item_id") REFERENCES "purchase_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "web_inquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "web_inquiries" ADD CONSTRAINT "web_inquiries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "web_inquiries" ADD CONSTRAINT "web_inquiries_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "web_inquiries" ADD CONSTRAINT "web_inquiries_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "web_inquiry_items" ADD CONSTRAINT "web_inquiry_items_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "web_inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "web_inquiry_items" ADD CONSTRAINT "web_inquiry_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- 10. Restricciones CHECK (reglas de negocio que la base garantiza aunque falle la API)
-- ---------------------------------------------------------------------
ALTER TABLE "users"
  ADD CONSTRAINT chk_users_username CHECK ("username" ~ '^[a-z0-9._-]{3,50}$'),
  ADD CONSTRAINT chk_users_email    CHECK ("email" = lower("email") AND "email" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  ADD CONSTRAINT chk_users_names    CHECK (btrim("first_name") <> '' AND btrim("last_name") <> '');

ALTER TABLE "customer_accounts"
  ADD CONSTRAINT chk_customer_accounts_email CHECK ("email" = lower("email") AND "email" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  ADD CONSTRAINT chk_customer_accounts_name  CHECK (btrim("contact_name") <> '');

ALTER TABLE "customers"
  ADD CONSTRAINT chk_customers_name  CHECK (btrim("name") <> ''),
  ADD CONSTRAINT chk_customers_email CHECK ("email" IS NULL OR ("email" = lower("email") AND "email" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));

ALTER TABLE "suppliers"
  ADD CONSTRAINT chk_suppliers_name  CHECK (btrim("name") <> ''),
  ADD CONSTRAINT chk_suppliers_email CHECK ("email" IS NULL OR ("email" = lower("email") AND "email" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));

ALTER TABLE "password_reset_codes"
  ADD CONSTRAINT chk_reset_codes_owner    CHECK (num_nonnulls("user_id", "customer_account_id") = 1),
  ADD CONSTRAINT chk_reset_codes_hash     CHECK ("code_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT chk_reset_codes_attempts CHECK ("attempts" BETWEEN 0 AND 20),
  ADD CONSTRAINT chk_reset_codes_expiry   CHECK ("expires_at" > "created_at");

ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT chk_reset_tokens_owner  CHECK (num_nonnulls("user_id", "customer_account_id") = 1),
  ADD CONSTRAINT chk_reset_tokens_hash   CHECK ("token_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT chk_reset_tokens_expiry CHECK ("expires_at" > "created_at");

ALTER TABLE "locations"
  ADD CONSTRAINT chk_locations_code CHECK ("code" = upper(btrim("code")) AND "code" <> '');

ALTER TABLE "products"
  ADD CONSTRAINT chk_products_sku       CHECK ("sku" = upper(btrim("sku")) AND "sku" <> ''),
  ADD CONSTRAINT chk_products_name      CHECK (btrim("name") <> ''),
  ADD CONSTRAINT chk_products_barcode   CHECK ("barcode" IS NULL OR btrim("barcode") <> ''),
  ADD CONSTRAINT chk_products_max_stock CHECK ("max_stock" IS NULL OR "max_stock" >= "min_stock");

ALTER TABLE "product_prices"
  ADD CONSTRAINT chk_product_prices_price CHECK ("price" >= 0),
  ADD CONSTRAINT chk_product_prices_range CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from");

ALTER TABLE "product_suppliers"
  ADD CONSTRAINT chk_product_suppliers_cost      CHECK ("last_cost" IS NULL OR "last_cost" >= 0),
  ADD CONSTRAINT chk_product_suppliers_lead_time CHECK ("lead_time_days" IS NULL OR "lead_time_days" BETWEEN 0 AND 365);

ALTER TABLE "inventory_movements"
  ADD CONSTRAINT chk_movements_stock          CHECK ("stock_before" >= 0 AND "stock_after" >= 0),
  ADD CONSTRAINT chk_movements_balance        CHECK (
        ("type" = 'ENTRY'      AND "stock_after" = "stock_before" + "quantity")
     OR ("type" = 'EXIT'       AND "stock_after" = "stock_before" - "quantity")
     OR ("type" = 'ADJUSTMENT' AND abs("stock_after" - "stock_before") = "quantity")),
  ADD CONSTRAINT chk_movements_supplier_entry CHECK ("supplier_id" IS NULL OR "type" = 'ENTRY'),
  ADD CONSTRAINT chk_movements_receipt_entry  CHECK ("purchase_receipt_item_id" IS NULL OR "type" = 'ENTRY'),
  ADD CONSTRAINT chk_movements_single_source  CHECK (num_nonnulls("sale_id", "purchase_receipt_item_id") <= 1);

ALTER TABLE "purchases"
  ADD CONSTRAINT chk_purchases_amounts   CHECK ("subtotal" >= 0 AND "additional_costs" >= 0 AND "total" = "subtotal" + "additional_costs"),
  ADD CONSTRAINT chk_purchases_rate      CHECK ("exchange_rate" > 0 AND ("currency" <> 'NIO' OR "exchange_rate" = 1)),
  ADD CONSTRAINT chk_purchases_ordered   CHECK ("status" IN ('DRAFT', 'CANCELLED') OR "ordered_at" IS NOT NULL),
  ADD CONSTRAINT chk_purchases_cancelled CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL)
                                            AND ("status" <> 'CANCELLED' OR "cancellation_reason" IS NOT NULL));

ALTER TABLE "purchase_items"
  ADD CONSTRAINT chk_purchase_items_qty      CHECK ("quantity" > 0 AND "received_quantity" BETWEEN 0 AND "quantity"),
  ADD CONSTRAINT chk_purchase_items_cost     CHECK ("unit_cost" >= 0),
  ADD CONSTRAINT chk_purchase_items_subtotal CHECK ("subtotal" = round("quantity" * "unit_cost", 2));

ALTER TABLE "purchase_receipt_items"
  ADD CONSTRAINT chk_receipt_items_qty  CHECK ("quantity" > 0),
  ADD CONSTRAINT chk_receipt_items_cost CHECK ("unit_cost" >= 0);

ALTER TABLE "quotations"
  ADD CONSTRAINT chk_quotations_amounts  CHECK ("subtotal" >= 0 AND "tax" >= 0 AND "total" = "subtotal" + "tax"),
  ADD CONSTRAINT chk_quotations_tax_rate CHECK ("tax_rate" BETWEEN 0 AND 1),
  ADD CONSTRAINT chk_quotations_validity CHECK ("valid_until" > "issued_at");

ALTER TABLE "quotation_items"
  ADD CONSTRAINT chk_qitems_subtotal CHECK ("subtotal" = "quantity" * "unit_price");

ALTER TABLE "sales"
  ADD CONSTRAINT chk_sales_amounts  CHECK ("subtotal" >= 0 AND "tax" >= 0 AND "total" = "subtotal" + "tax"),
  ADD CONSTRAINT chk_sales_tax_rate CHECK ("tax_rate" BETWEEN 0 AND 1),
  ADD CONSTRAINT chk_sales_void     CHECK (("status" = 'VOIDED') = ("voided_at" IS NOT NULL)
                                       AND ("status" <> 'VOIDED' OR "void_reason" IS NOT NULL)),
  ADD CONSTRAINT chk_sales_credit   CHECK (("payment_method" = 'CREDIT') = ("due_date" IS NOT NULL)
                                       AND ("due_date" IS NULL OR "due_date" >= "sold_at")),
  -- El estado de pago concuerda con el saldo (una venta anulada queda con saldo 0).
  ADD CONSTRAINT chk_sales_payment_state CHECK (
        "status" = 'VOIDED'
     OR ("payment_status" = 'PAID'    AND "balance" = 0)
     OR ("payment_status" = 'PENDING' AND "balance" = "total")
     OR ("payment_status" = 'PARTIAL' AND "balance" > 0 AND "balance" < "total"));

ALTER TABLE "sale_items"
  ADD CONSTRAINT chk_sitems_cost     CHECK ("unit_cost" >= 0),
  ADD CONSTRAINT chk_sitems_subtotal CHECK ("subtotal" = "quantity" * "unit_price");

ALTER TABLE "payments"
  ADD CONSTRAINT chk_payments_method       CHECK ("method" IN ('CASH', 'TRANSFER')),
  ADD CONSTRAINT chk_payments_transfer_ref CHECK ("method" <> 'TRANSFER' OR btrim(coalesce("reference", '')) <> '');

ALTER TABLE "service_orders"
  ADD CONSTRAINT chk_orders_technician CHECK ("status" NOT IN ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'INVOICED') OR "technician_id" IS NOT NULL),
  ADD CONSTRAINT chk_orders_started    CHECK ("status" NOT IN ('IN_PROGRESS', 'COMPLETED', 'INVOICED') OR "started_at" IS NOT NULL),
  ADD CONSTRAINT chk_orders_finished   CHECK ("status" NOT IN ('COMPLETED', 'INVOICED') OR "finished_at" IS NOT NULL),
  ADD CONSTRAINT chk_orders_invoice    CHECK (("status" = 'INVOICED') = ("sale_id" IS NOT NULL)),
  ADD CONSTRAINT chk_orders_cancel     CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL)
                                          AND ("status" <> 'CANCELLED' OR "cancellation_reason" IS NOT NULL)),
  ADD CONSTRAINT chk_orders_dates      CHECK (("started_at" IS NULL OR "started_at" >= "registered_at")
                                          AND ("finished_at" IS NULL OR ("started_at" IS NOT NULL AND "finished_at" >= "started_at")));

ALTER TABLE "web_inquiries"
  ADD CONSTRAINT chk_inquiries_text CHECK (btrim("name") <> '' AND btrim("contact") <> '' AND btrim("code") <> '');

ALTER TABLE "web_inquiry_items"
  ADD CONSTRAINT chk_inquiry_items_qty CHECK ("quantity" > 0);

ALTER TABLE "document_sequences"
  ADD CONSTRAINT chk_sequences_value CHECK ("last_value" >= 0);

ALTER TABLE "system_config"
  ADD CONSTRAINT chk_system_config_key CHECK ("key" ~ '^[A-Z][A-Z0-9_]*$');

-- ---------------------------------------------------------------------
-- 11. Índices parciales (Prisma no los declara, pero los respeta)
-- ---------------------------------------------------------------------
-- Un solo precio vigente por producto.
CREATE UNIQUE INDEX "product_prices_open_key" ON "product_prices" ("product_id") WHERE "valid_to" IS NULL;
-- Un solo proveedor preferente por producto.
CREATE UNIQUE INDEX "product_suppliers_preferred_key" ON "product_suppliers" ("product_id") WHERE "is_preferred";
-- Una bodega y una sucursal predeterminadas.
CREATE UNIQUE INDEX "locations_default_type_key" ON "locations" ("type") WHERE "is_default";
-- Cuentas por cobrar y su antigüedad: solo ventas activas con saldo.
CREATE INDEX "sales_receivables_idx" ON "sales" ("due_date") WHERE "status" = 'ACTIVE' AND "balance" > 0;
-- Códigos de recuperación pendientes.
CREATE INDEX "password_reset_codes_pending_idx" ON "password_reset_codes" ("created_at") WHERE "used_at" IS NULL;

-- ---------------------------------------------------------------------
-- 12. Triggers
-- ---------------------------------------------------------------------
-- 12.1 Historial de precios: cada cambio de products.sale_price cierra el precio vigente y abre
--      uno nuevo. La API indica quién y por qué en la transacción:
--        SELECT set_config('app.user_id', '<uuid>', true), set_config('app.price_reason', '<motivo>', true);
CREATE FUNCTION siven_record_price_change() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_user   uuid := NULLIF(current_setting('app.user_id', true), '')::uuid;
  v_reason text := NULLIF(current_setting('app.price_reason', true), '');
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."sale_price" IS NOT DISTINCT FROM OLD."sale_price" THEN
    RETURN NULL;
  END IF;
  UPDATE "product_prices" SET "valid_to" = now()
   WHERE "product_id" = NEW."id" AND "valid_to" IS NULL;
  IF TG_OP = 'UPDATE' OR NEW."sale_price" > 0 THEN
    INSERT INTO "product_prices" ("id", "product_id", "price", "valid_from", "changed_by_id", "reason", "created_at")
    VALUES (gen_random_uuid(), NEW."id", NEW."sale_price", now(), v_user,
            COALESCE(v_reason, CASE TG_OP WHEN 'INSERT' THEN 'Precio inicial' ELSE 'Cambio de precio' END), now());
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_products_price_history
AFTER INSERT OR UPDATE OF "sale_price" ON "products"
FOR EACH ROW EXECUTE FUNCTION siven_record_price_change();

-- 12.2 Bitácoras de solo inserción: movimientos de inventario, pagos y auditoría no se
--      modifican ni se borran (una corrección es un movimiento nuevo).
CREATE FUNCTION siven_forbid_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo inserción: registre un movimiento nuevo en lugar de modificarla', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END $$;

CREATE TRIGGER trg_inventory_movements_append_only BEFORE UPDATE OR DELETE ON "inventory_movements"
FOR EACH ROW EXECUTE FUNCTION siven_forbid_change();
CREATE TRIGGER trg_payments_append_only BEFORE UPDATE OR DELETE ON "payments"
FOR EACH ROW EXECUTE FUNCTION siven_forbid_change();
CREATE TRIGGER trg_audit_logs_append_only BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION siven_forbid_change();

-- ---------------------------------------------------------------------
-- 13. Diccionario de datos dentro de la base (visible en pgAdmin / \d+)
-- ---------------------------------------------------------------------
COMMENT ON TABLE "users" IS 'Personal interno de NORCOR; inicia sesión con usuario o correo';
COMMENT ON TABLE "roles" IS 'Roles del sistema (Administrador, Gerencia, Vendedor, Inventario, Contabilidad, Técnico)';
COMMENT ON TABLE "permissions" IS 'Permisos módulo:acción (ej. products:write)';
COMMENT ON TABLE "role_permissions" IS 'Permisos de cada rol (N:M)';
COMMENT ON TABLE "password_reset_codes" IS 'Recuperación de contraseña, paso 2: hash del código enviado por correo';
COMMENT ON TABLE "password_reset_tokens" IS 'Recuperación de contraseña, paso 3: hash del permiso temporal para fijar la nueva clave';
COMMENT ON TABLE "locations" IS 'Bodega principal y sucursal; las existencias se manejan consolidadas';
COMMENT ON TABLE "categories" IS 'Categorías de repuestos';
COMMENT ON TABLE "brands" IS 'Marcas de repuestos';
COMMENT ON TABLE "products" IS 'Datos maestros del repuesto; stock y costo solo cambian con movimientos de inventario';
COMMENT ON TABLE "product_prices" IS 'Historial de precios comerciales (lo mantiene trg_products_price_history)';
COMMENT ON TABLE "product_suppliers" IS 'Proveedores de cada producto con último costo y plazo de entrega';
COMMENT ON TABLE "customers" IS 'Clientes (empresas o personas)';
COMMENT ON TABLE "customer_accounts" IS 'Cuentas del portal de clientes (login externo)';
COMMENT ON TABLE "suppliers" IS 'Proveedores nacionales e internacionales';
COMMENT ON TABLE "inventory_movements" IS 'Bitácora de existencias (solo inserción): entradas, salidas y ajustes';
COMMENT ON TABLE "purchases" IS 'Órdenes de compra a proveedores';
COMMENT ON TABLE "purchase_items" IS 'Líneas de la orden de compra y cantidad recibida';
COMMENT ON TABLE "purchase_receipts" IS 'Recepciones (totales o parciales) de una compra';
COMMENT ON TABLE "purchase_receipt_items" IS 'Líneas recibidas; cada una genera una entrada de inventario';
COMMENT ON TABLE "quotations" IS 'Cotizaciones (proformas) y su ciclo de estados';
COMMENT ON TABLE "quotation_items" IS 'Líneas de la cotización';
COMMENT ON TABLE "sales" IS 'Ventas y facturas; saldo y estado de pago';
COMMENT ON TABLE "sale_items" IS 'Líneas de la venta con precio y costo al momento de vender';
COMMENT ON TABLE "payments" IS 'Abonos a ventas (solo inserción)';
COMMENT ON TABLE "service_orders" IS 'Órdenes de servicio técnico (OPI)';
COMMENT ON TABLE "document_sequences" IS 'Numeración correlativa sin huecos de documentos';
COMMENT ON TABLE "web_inquiries" IS 'Solicitudes de cotización del sitio público (se conservan como evidencia)';
COMMENT ON TABLE "web_inquiry_items" IS 'Productos y cantidades de cada solicitud web';
COMMENT ON TABLE "audit_logs" IS 'Bitácora de auditoría (solo inserción)';
COMMENT ON TABLE "system_config" IS 'Parámetros del negocio (impuesto, crédito, datos de la empresa)';
COMMENT ON COLUMN "products"."sale_price" IS 'Precio comercial vigente; su historial está en product_prices';
COMMENT ON COLUMN "products"."avg_cost" IS 'Costo promedio móvil; lo recalculan las entradas';
COMMENT ON COLUMN "sales"."tax_rate" IS 'Tasa aplicada al facturar (0 en cuota fija)';
COMMENT ON COLUMN "sales"."balance" IS 'Saldo pendiente; 0 si está pagada o anulada';
COMMENT ON COLUMN "inventory_movements"."sale_id" IS 'Venta que originó la salida (o la devolución al anularla)';

COMMIT;
