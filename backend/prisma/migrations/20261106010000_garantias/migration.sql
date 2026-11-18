-- =====================================================================
-- Garantías en las órdenes de servicio (OPI) (mejora n.° 60).
--
-- products.warranty_days: garantía desde la venta, en días (NULL = sin garantía).
-- service_orders.under_warranty: la orden no se cobra; la cubre un producto comprado
--   (warranty_sale_id + warranty_product_id) o un servicio anterior (warranty_order_id) con
--   garantía vigente. Una orden en garantía termina en COMPLETADA, nunca en FACTURADA.
-- service_orders.service_warranty_days / warranty_until: garantía del trabajo realizado,
--   fijada al completar la orden.
-- service_orders.inquiry_id: solicitud web (servicio técnico o reclamo) que originó la orden.
-- Las órdenes existentes quedan como facturables y sin garantía.
-- =====================================================================

ALTER TABLE "products" ADD COLUMN "warranty_days" INTEGER;

ALTER TABLE "service_orders"
  ADD COLUMN "under_warranty" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "warranty_sale_id" UUID,
  ADD COLUMN "warranty_product_id" UUID,
  ADD COLUMN "warranty_order_id" UUID,
  ADD COLUMN "service_warranty_days" INTEGER,
  ADD COLUMN "warranty_until" TIMESTAMPTZ(3),
  ADD COLUMN "inquiry_id" UUID;

-- Índices
CREATE UNIQUE INDEX "service_orders_inquiry_id_key" ON "service_orders"("inquiry_id");
CREATE INDEX "service_orders_under_warranty_idx" ON "service_orders"("under_warranty");
CREATE INDEX "service_orders_warranty_sale_id_idx" ON "service_orders"("warranty_sale_id");
CREATE INDEX "service_orders_warranty_product_id_idx" ON "service_orders"("warranty_product_id");
CREATE INDEX "service_orders_warranty_order_id_idx" ON "service_orders"("warranty_order_id");

-- Llaves foráneas
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_warranty_sale_id_fkey" FOREIGN KEY ("warranty_sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_warranty_product_id_fkey" FOREIGN KEY ("warranty_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_warranty_order_id_fkey" FOREIGN KEY ("warranty_order_id") REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "web_inquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricciones
ALTER TABLE "products"
  ADD CONSTRAINT chk_products_warranty_days CHECK ("warranty_days" IS NULL OR "warranty_days" BETWEEN 1 AND 3650);

ALTER TABLE "service_orders"
  -- Venta y producto van juntos.
  ADD CONSTRAINT chk_service_orders_warranty_pair CHECK (("warranty_sale_id" IS NULL) = ("warranty_product_id" IS NULL)),
  -- Una garantía tiene una sola fuente: un producto comprado o un servicio anterior.
  ADD CONSTRAINT chk_service_orders_warranty_source CHECK (
        NOT "under_warranty"
     OR ("warranty_sale_id" IS NOT NULL) <> ("warranty_order_id" IS NOT NULL)),
  ADD CONSTRAINT chk_service_orders_warranty_only CHECK (
        "under_warranty" OR ("warranty_sale_id" IS NULL AND "warranty_order_id" IS NULL)),
  -- En garantía no se cobra: nunca pasa a FACTURADA.
  ADD CONSTRAINT chk_service_orders_warranty_not_invoiced CHECK (
        NOT "under_warranty" OR ("sale_id" IS NULL AND "status" <> 'INVOICED')),
  ADD CONSTRAINT chk_service_orders_warranty_not_self CHECK ("warranty_order_id" IS NULL OR "warranty_order_id" <> "id"),
  ADD CONSTRAINT chk_service_orders_service_warranty CHECK (
        ("service_warranty_days" IS NULL OR "service_warranty_days" BETWEEN 0 AND 3650)
    AND ("warranty_until" IS NULL OR "status" IN ('COMPLETED', 'INVOICED')));
