/* =====================================================================
   Reglas de negocio configurables del frontend.
   Se centralizan aquí para que cambiarlas no obligue a tocar componentes.
   ===================================================================== */
// El impuesto ya no vive aquí: lo define el servidor (system_config → GET /settings).
// NORCOR está en régimen de cuota fija, así que por defecto no se cobra IVA.

/** WhatsApp de respaldo del sitio público. El número real se configura en el servidor
    (system_config → COMPANY_WHATSAPP) y tiene prioridad sobre este. */
export const WHATSAPP_NUMBER = '50588001100';
