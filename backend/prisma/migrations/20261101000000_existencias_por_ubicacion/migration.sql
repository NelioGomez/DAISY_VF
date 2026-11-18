-- =====================================================================
-- Existencias por ubicación (Bodega principal / Sucursal) y traslados (mejora n.° 23).
--
-- products.stock sigue siendo el total que usan ventas, catálogo, reportes y dashboard;
-- product_stocks lo reparte entre las dos ubicaciones fijas. Un trigger diferido verifica
-- al confirmar cada transacción que la suma por ubicación sea igual al total.
-- Al migrar, toda la existencia actual queda en la Bodega principal (id 1).
-- =====================================================================

-- 1. Existencias por ubicación
CREATE TABLE "product_stocks" (
    "product_id" UUID NOT NULL,
    "location_id" SMALLINT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_stocks_pkey" PRIMARY KEY ("product_id","location_id")
);

-- 2. Traslados entre ubicaciones
CREATE TABLE "stock_transfers" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "from_location_id" SMALLINT NOT NULL,
    "to_location_id" SMALLINT NOT NULL,
    "note" VARCHAR(500),
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "inventory_movements" ADD COLUMN "transfer_id" UUID;

-- 3. Índices
CREATE INDEX "product_stocks_location_id_idx" ON "product_stocks"("location_id");
CREATE UNIQUE INDEX "stock_transfers_code_key" ON "stock_transfers"("code");
CREATE INDEX "stock_transfers_user_id_idx" ON "stock_transfers"("user_id");
CREATE INDEX "stock_transfers_created_at_idx" ON "stock_transfers"("created_at");
CREATE INDEX "inventory_movements_transfer_id_idx" ON "inventory_movements"("transfer_id");

-- 4. Llaves foráneas
ALTER TABLE "product_stocks" ADD CONSTRAINT "product_stocks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_stocks" ADD CONSTRAINT "product_stocks_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Restricciones
ALTER TABLE "product_stocks"
  ADD CONSTRAINT chk_product_stocks_quantity CHECK ("quantity" >= 0);
ALTER TABLE "stock_transfers"
  ADD CONSTRAINT chk_stock_transfers_locations CHECK ("from_location_id" <> "to_location_id");
-- Un movimiento de traslado es solo salida o entrada, y no pertenece a otro documento.
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT chk_movements_transfer CHECK (
        "transfer_id" IS NULL
     OR ("type" <> 'ADJUSTMENT'
         AND num_nonnulls("sale_id", "purchase_receipt_item_id", "production_order_id", "supplier_id") = 0));

-- 6. Existencia inicial: todo el stock actual queda en la Bodega principal.
INSERT INTO "product_stocks" ("product_id", "location_id", "quantity", "updated_at")
SELECT "id", 1, "stock", now() FROM "products" WHERE "stock" > 0;

-- 7. Integridad: suma por ubicación = stock total (se verifica al confirmar la transacción).
CREATE OR REPLACE FUNCTION fn_check_product_stock_by_location() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  pid uuid;
  total integer;
  repartido integer;
BEGIN
  IF TG_TABLE_NAME = 'products' THEN
    pid := NEW."id";
  ELSIF TG_OP = 'DELETE' THEN
    pid := OLD."product_id";
  ELSE
    pid := NEW."product_id";
  END IF;
  SELECT "stock" INTO total FROM "products" WHERE "id" = pid;
  IF total IS NULL THEN
    RETURN NULL; -- el producto ya no existe
  END IF;
  SELECT COALESCE(SUM("quantity"), 0) INTO repartido FROM "product_stocks" WHERE "product_id" = pid;
  IF total <> repartido THEN
    RAISE EXCEPTION 'Existencias inconsistentes del producto %: total %, suma por ubicación %', pid, total, repartido
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_products_stock_by_location
  AFTER INSERT OR UPDATE OF "stock" ON "products"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION fn_check_product_stock_by_location();

CREATE CONSTRAINT TRIGGER trg_product_stocks_total
  AFTER INSERT OR UPDATE OR DELETE ON "product_stocks"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION fn_check_product_stock_by_location();

-- 8. Nombres visibles de las ubicaciones fijas.
UPDATE "locations" SET "name" = 'Sucursal principal' WHERE "id" = 2 AND "name" = 'Sucursal';

COMMENT ON TABLE "product_stocks" IS 'Reparto de products.stock entre la Bodega principal y la Sucursal (suma = total, verificado por trigger)';
COMMENT ON TABLE "stock_transfers" IS 'Traslados TR-000001 entre ubicaciones: una salida en el origen y una entrada en el destino por línea';
COMMENT ON COLUMN "inventory_movements"."transfer_id" IS 'Traslado que originó el movimiento';
