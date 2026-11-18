-- =====================================================================
-- Motivo de las solicitudes web (mejora n.° 59).
--
-- El formulario de Contacto recibe de todo (precios, servicio técnico, datos de la cuenta,
-- reclamos); antes todo quedaba como pedido de cotización. Ahora cada solicitud guarda su motivo
-- y solo las de cotización pueden quedar COTIZADAS. Las existentes eran pedidos de cotización.
-- =====================================================================

CREATE TYPE "InquiryType" AS ENUM ('QUOTE', 'SERVICE', 'ACCOUNT', 'COMPLAINT', 'OTHER');

ALTER TABLE "web_inquiries" ADD COLUMN "type" "InquiryType" NOT NULL DEFAULT 'QUOTE';

CREATE INDEX "web_inquiries_type_idx" ON "web_inquiries"("type");

ALTER TABLE "web_inquiries"
  ADD CONSTRAINT chk_inquiries_quoted_type CHECK ("status" <> 'QUOTED' OR "type" = 'QUOTE');
