-- Restricciones CHECK (Prisma no las soporta en schema.prisma).
-- Se pegan al FINAL de la migración inicial generada con:
--   npx prisma migrate dev --name init --create-only
-- y luego se aplica con:  npx prisma migrate dev

ALTER TABLE products
  ADD CONSTRAINT chk_products_avg_cost  CHECK (avg_cost  >= 0),
  ADD CONSTRAINT chk_products_price     CHECK (sale_price >= 0),
  ADD CONSTRAINT chk_products_stock     CHECK (stock     >= 0),
  ADD CONSTRAINT chk_products_min_stock CHECK (min_stock >= 0);

ALTER TABLE inventory_movements
  ADD CONSTRAINT chk_movements_qty  CHECK (quantity > 0),
  ADD CONSTRAINT chk_movements_cost CHECK (unit_cost >= 0);

ALTER TABLE quotation_items
  ADD CONSTRAINT chk_qitems_qty   CHECK (quantity > 0),
  ADD CONSTRAINT chk_qitems_price CHECK (unit_price >= 0);

ALTER TABLE sale_items
  ADD CONSTRAINT chk_sitems_qty   CHECK (quantity > 0),
  ADD CONSTRAINT chk_sitems_price CHECK (unit_price >= 0);

ALTER TABLE sales
  ADD CONSTRAINT chk_sales_total   CHECK (total >= 0),
  ADD CONSTRAINT chk_sales_balance CHECK (balance >= 0 AND balance <= total);

ALTER TABLE payments
  ADD CONSTRAINT chk_payments_amount CHECK (amount > 0);
