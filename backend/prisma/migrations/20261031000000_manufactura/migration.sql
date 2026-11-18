-- =====================================================================
-- Manufactura (proyecto integrador ERP, entrega 2)
-- BOM, rutas de producción, órdenes de producción (OP), consumo de materiales,
-- lotes y control de calidad con disposición de no conformidades.
-- Se conecta con el inventario existente: el consumo es una SALIDA y el producto
-- terminado ENTRA cuando calidad libera las unidades del lote.
-- =====================================================================

-- AlterEnum: la manguera a granel se compra y se consume por pie.
ALTER TYPE "UnitOfMeasure" ADD VALUE IF NOT EXISTS 'FOOT';

-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductionStepStatus" AS ENUM ('PENDING', 'DONE');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('PENDING_QC', 'REWORK', 'RELEASED', 'SCRAPPED');

-- CreateEnum
CREATE TYPE "InspectionStage" AS ENUM ('INITIAL', 'REWORK');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('CONFORMING', 'NONCONFORMING');

-- CreateEnum
CREATE TYPE "NonconformityDisposition" AS ENUM ('REWORK', 'SCRAP', 'RELEASE');

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "production_lot_id" UUID,
ADD COLUMN     "production_order_id" UUID;

-- CreateTable
CREATE TABLE "boms" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "product_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" VARCHAR(500),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "boms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_items" (
    "id" UUID NOT NULL,
    "bom_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" VARCHAR(255),

    CONSTRAINT "bom_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_routes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "product_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "production_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_operations" (
    "id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "work_center" VARCHAR(80),
    "standard_minutes" INTEGER NOT NULL DEFAULT 0,
    "instructions" VARCHAR(500),

    CONSTRAINT "route_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "product_id" UUID NOT NULL,
    "bom_id" UUID NOT NULL,
    "route_id" UUID,
    "quantity" INTEGER NOT NULL,
    "produced_quantity" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "planned_start" TIMESTAMPTZ(3),
    "due_date" TIMESTAMPTZ(3),
    "released_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancellation_reason" VARCHAR(500),
    "material_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" VARCHAR(1000),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_consumptions" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "planned_quantity" INTEGER NOT NULL,
    "consumed_quantity" INTEGER NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(14,4) NOT NULL DEFAULT 0,

    CONSTRAINT "production_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_order_steps" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "work_center" VARCHAR(80),
    "standard_minutes" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductionStepStatus" NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMPTZ(3),
    "completed_by_id" UUID,
    "notes" VARCHAR(500),

    CONSTRAINT "production_order_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_lots" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pending_quantity" INTEGER NOT NULL,
    "rework_quantity" INTEGER NOT NULL DEFAULT 0,
    "released_quantity" INTEGER NOT NULL DEFAULT 0,
    "scrapped_quantity" INTEGER NOT NULL DEFAULT 0,
    "status" "LotStatus" NOT NULL DEFAULT 'PENDING_QC',
    "unit_cost" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "produced_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_inspections" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "lot_id" UUID NOT NULL,
    "stage" "InspectionStage" NOT NULL,
    "inspected_quantity" INTEGER NOT NULL,
    "defective_quantity" INTEGER NOT NULL DEFAULT 0,
    "result" "InspectionResult" NOT NULL,
    "disposition" "NonconformityDisposition",
    "defect_description" VARCHAR(500),
    "notes" VARCHAR(500),
    "inspector_id" UUID NOT NULL,
    "inspected_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "boms_code_key" ON "boms"("code");

-- CreateIndex
CREATE INDEX "boms_created_by_id_idx" ON "boms"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "boms_product_id_version_key" ON "boms"("product_id", "version");

-- CreateIndex
CREATE INDEX "bom_items_component_id_idx" ON "bom_items"("component_id");

-- CreateIndex
CREATE UNIQUE INDEX "bom_items_bom_id_component_id_key" ON "bom_items"("bom_id", "component_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_routes_code_key" ON "production_routes"("code");

-- CreateIndex
CREATE INDEX "production_routes_product_id_idx" ON "production_routes"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "route_operations_route_id_sequence_key" ON "route_operations"("route_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_code_key" ON "production_orders"("code");

-- CreateIndex
CREATE INDEX "production_orders_product_id_idx" ON "production_orders"("product_id");

-- CreateIndex
CREATE INDEX "production_orders_bom_id_idx" ON "production_orders"("bom_id");

-- CreateIndex
CREATE INDEX "production_orders_route_id_idx" ON "production_orders"("route_id");

-- CreateIndex
CREATE INDEX "production_orders_status_idx" ON "production_orders"("status");

-- CreateIndex
CREATE INDEX "production_orders_created_by_id_idx" ON "production_orders"("created_by_id");

-- CreateIndex
CREATE INDEX "production_orders_created_at_idx" ON "production_orders"("created_at");

-- CreateIndex
CREATE INDEX "production_consumptions_component_id_idx" ON "production_consumptions"("component_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_consumptions_order_id_component_id_key" ON "production_consumptions"("order_id", "component_id");

-- CreateIndex
CREATE INDEX "production_order_steps_completed_by_id_idx" ON "production_order_steps"("completed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_order_steps_order_id_sequence_key" ON "production_order_steps"("order_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "production_lots_code_key" ON "production_lots"("code");

-- CreateIndex
CREATE INDEX "production_lots_order_id_idx" ON "production_lots"("order_id");

-- CreateIndex
CREATE INDEX "production_lots_product_id_idx" ON "production_lots"("product_id");

-- CreateIndex
CREATE INDEX "production_lots_status_idx" ON "production_lots"("status");

-- CreateIndex
CREATE UNIQUE INDEX "quality_inspections_code_key" ON "quality_inspections"("code");

-- CreateIndex
CREATE INDEX "quality_inspections_lot_id_idx" ON "quality_inspections"("lot_id");

-- CreateIndex
CREATE INDEX "quality_inspections_inspector_id_idx" ON "quality_inspections"("inspector_id");

-- CreateIndex
CREATE INDEX "quality_inspections_inspected_at_idx" ON "quality_inspections"("inspected_at");

-- CreateIndex
CREATE INDEX "inventory_movements_production_order_id_idx" ON "inventory_movements"("production_order_id");

-- CreateIndex
CREATE INDEX "inventory_movements_production_lot_id_idx" ON "inventory_movements"("production_lot_id");

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_production_lot_id_fkey" FOREIGN KEY ("production_lot_id") REFERENCES "production_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_routes" ADD CONSTRAINT "production_routes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_operations" ADD CONSTRAINT "route_operations_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "production_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "boms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "production_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_consumptions" ADD CONSTRAINT "production_consumptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_consumptions" ADD CONSTRAINT "production_consumptions_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_steps" ADD CONSTRAINT "production_order_steps_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_steps" ADD CONSTRAINT "production_order_steps_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_lots" ADD CONSTRAINT "production_lots_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_lots" ADD CONSTRAINT "production_lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "production_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- Reglas de integridad que Prisma no expresa en el esquema
-- ---------------------------------------------------------------------
ALTER TABLE "boms"
  ADD CONSTRAINT chk_boms_version CHECK ("version" > 0);

ALTER TABLE "bom_items"
  ADD CONSTRAINT chk_bom_items_quantity CHECK ("quantity" > 0);

ALTER TABLE "route_operations"
  ADD CONSTRAINT chk_route_operations_sequence CHECK ("sequence" > 0),
  ADD CONSTRAINT chk_route_operations_minutes  CHECK ("standard_minutes" >= 0);

ALTER TABLE "production_orders"
  ADD CONSTRAINT chk_production_orders_qty       CHECK ("quantity" > 0 AND "produced_quantity" BETWEEN 0 AND "quantity"),
  ADD CONSTRAINT chk_production_orders_cost      CHECK ("material_cost" >= 0),
  ADD CONSTRAINT chk_production_orders_started   CHECK ("status" NOT IN ('IN_PROGRESS', 'COMPLETED') OR "started_at" IS NOT NULL),
  ADD CONSTRAINT chk_production_orders_completed CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL)),
  ADD CONSTRAINT chk_production_orders_cancelled CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL AND "cancellation_reason" IS NOT NULL)),
  ADD CONSTRAINT chk_production_orders_dates     CHECK ("due_date" IS NULL OR "planned_start" IS NULL OR "due_date" >= "planned_start");

ALTER TABLE "production_consumptions"
  ADD CONSTRAINT chk_production_consumptions_qty  CHECK ("planned_quantity" > 0 AND "consumed_quantity" >= 0),
  ADD CONSTRAINT chk_production_consumptions_cost CHECK ("unit_cost" >= 0);

ALTER TABLE "production_order_steps"
  ADD CONSTRAINT chk_production_order_steps_sequence CHECK ("sequence" > 0 AND "standard_minutes" >= 0),
  ADD CONSTRAINT chk_production_order_steps_done     CHECK (("status" = 'DONE') = ("completed_at" IS NOT NULL));

ALTER TABLE "production_lots"
  ADD CONSTRAINT chk_production_lots_qty CHECK (
    "quantity" > 0 AND "pending_quantity" >= 0 AND "rework_quantity" >= 0
    AND "released_quantity" >= 0 AND "scrapped_quantity" >= 0
    AND "pending_quantity" + "rework_quantity" + "released_quantity" + "scrapped_quantity" = "quantity"),
  ADD CONSTRAINT chk_production_lots_cost CHECK ("unit_cost" >= 0);

ALTER TABLE "quality_inspections"
  ADD CONSTRAINT chk_quality_inspections_qty         CHECK ("inspected_quantity" > 0 AND "defective_quantity" BETWEEN 0 AND "inspected_quantity"),
  ADD CONSTRAINT chk_quality_inspections_result      CHECK (("result" = 'NONCONFORMING') = ("defective_quantity" > 0)),
  ADD CONSTRAINT chk_quality_inspections_disposition CHECK (("disposition" IS NOT NULL) = ("defective_quantity" > 0));

COMMENT ON TABLE "boms" IS 'Lista de materiales: componentes que consume una unidad del producto terminado';
COMMENT ON TABLE "production_routes" IS 'Ruta de producción: operaciones en orden';
COMMENT ON TABLE "production_orders" IS 'Órdenes de producción (OP)';
COMMENT ON TABLE "production_consumptions" IS 'Materiales planificados y consumidos por cada OP';
COMMENT ON TABLE "production_order_steps" IS 'Pasos de la ruta ejecutados en cada OP';
COMMENT ON TABLE "production_lots" IS 'Lotes de producto terminado; entran al inventario al liberarlos calidad';
COMMENT ON TABLE "quality_inspections" IS 'Inspecciones de calidad con disposición de no conformidades';

-- ---------------------------------------------------------------------
-- Permisos del módulo (misma matriz que prisma/seed.ts)
-- ---------------------------------------------------------------------
INSERT INTO "permissions" ("id", "code", "description")
SELECT gen_random_uuid(), c, d FROM (VALUES
  ('production:read',  'Consultar BOM, rutas, órdenes de producción y lotes'),
  ('production:write', 'Registrar BOM, rutas y órdenes de producción'),
  ('quality:read',     'Consultar inspecciones de calidad'),
  ('quality:write',    'Registrar inspecciones y disposición de no conformidades')) AS v(c, d)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
  FROM (VALUES
    ('ADMIN', 'production:read'), ('ADMIN', 'production:write'), ('ADMIN', 'quality:read'), ('ADMIN', 'quality:write'),
    ('MANAGEMENT', 'production:read'), ('MANAGEMENT', 'quality:read'),
    ('INVENTORY_MANAGER', 'production:read'), ('INVENTORY_MANAGER', 'production:write'),
    ('INVENTORY_MANAGER', 'quality:read'), ('INVENTORY_MANAGER', 'quality:write')) AS m(role_code, perm_code)
  JOIN "roles" r ON r."code"::text = m.role_code
  JOIN "permissions" p ON p."code" = m.perm_code
ON CONFLICT DO NOTHING;
