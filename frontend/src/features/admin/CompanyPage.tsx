/* Administración › Empresa: datos de contacto que muestra el sitio público (teléfono, WhatsApp,
   correo, dirección, horario), el RUC que sale en la factura impresa y en la cotización del portal
   (mejora n.° 72) y los parámetros de facturación (régimen, tasa de IVA, plazo de crédito). */
import { useEffect, useState } from 'react';
import { Field } from '../../components/forms/Field';
import { useToast } from '../../components/feedback/useToast';
import { errorMessage } from '../../services/api/client';
import { adminApi } from './adminApi';
import { AdminHead } from './ui';

interface Form {
  COMPANY_NAME: string;
  COMPANY_RUC: string;
  COMPANY_PHONE: string;
  COMPANY_WHATSAPP: string;
  COMPANY_EMAIL: string;
  COMPANY_ADDRESS: string;
  COMPANY_HOURS: string;
  TAX_REGIME: string;
  TAX_RATE: string;
  CREDIT_TERM_DAYS: string;
}

export function CompanyPage() {
  const toast = useToast();
  const [f, setF] = useState<Form | null>(null);
  const [inicial, setInicial] = useState<Form | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi
      .configuracion()
      .then((c) => {
        const v: Form = {
          COMPANY_NAME: c.company.name,
          COMPANY_RUC: c.company.ruc ?? '',
          COMPANY_PHONE: c.company.phone,
          COMPANY_WHATSAPP: c.company.whatsapp,
          COMPANY_EMAIL: c.company.email,
          COMPANY_ADDRESS: c.company.address,
          COMPANY_HOURS: c.company.hours,
          TAX_REGIME: c.taxRegime,
          TAX_RATE: String(Math.round(c.taxRate * 100)),
          CREDIT_TERM_DAYS: String(c.creditTermDays),
        };
        setF(v);
        setInicial(v);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  if (error) return <div className="adm-error">{error}</div>;
  if (!f || !inicial) return <p className="muted-sm">Cargando…</p>;

  const set = (k: keyof Form) => (v: string) => setF((x) => (x ? { ...x, [k]: v } : x));
  const cambios = (Object.keys(f) as Array<keyof Form>).filter((k) => f[k] !== inicial[k]);
  const tasa = Number(f.TAX_RATE);
  const tasaOk = f.TAX_REGIME === 'CUOTA_FIJA' || (/^\d{1,3}$/.test(f.TAX_RATE) && tasa >= 0 && tasa <= 100);
  const rucOk = !f.COMPANY_RUC.trim() || /^[A-Za-z0-9][A-Za-z0-9-]{3,29}$/.test(f.COMPANY_RUC.trim());
  const diasOk = /^\d{1,3}$/.test(f.CREDIT_TERM_DAYS) && +f.CREDIT_TERM_DAYS >= 1 && +f.CREDIT_TERM_DAYS <= 365;

  const guardar = async () => {
    setSaving(true);
    try {
      const values: Record<string, string> = {};
      for (const k of cambios) values[k] = f[k].trim();
      if (cambios.includes('TAX_REGIME') || cambios.includes('TAX_RATE')) values.TAX_RATE = f.TAX_REGIME === 'CUOTA_FIJA' ? '0' : String(tasa / 100);
      await adminApi.guardarConfiguracion(values);
      setInicial(f);
      toast('Datos de la empresa guardados', 'ok');
    } catch (e) {
      toast(errorMessage(e), 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdminHead
        titulo="Empresa"
        desc="Datos de contacto que ven los clientes en el sitio y parámetros de facturación."
        acciones={
          <button type="button" className="b b-amber" onClick={guardar} disabled={!cambios.length || !f.COMPANY_NAME.trim() || !rucOk || !tasaOk || !diasOk || saving}>
            {saving ? 'Guardando…' : cambios.length ? `Guardar cambios (${cambios.length})` : 'Sin cambios'}
          </button>
        }
      />
      <div className="adm-grid2">
        <section className="adm-card-sec">
          <h2>Contacto</h2>
          <p className="muted-sm">Se muestran en Contacto, en el pie del sitio, en los botones de WhatsApp y en los documentos impresos.</p>
          <div className="form-grid">
            <Field label="Nombre de la empresa" htmlFor="emp-nombre">
              <input id="emp-nombre" value={f.COMPANY_NAME} onChange={(e) => set('COMPANY_NAME')(e.target.value)} maxLength={120} />
            </Field>
            <Field label="RUC" htmlFor="emp-ruc" help={rucOk ? 'Sale en la factura impresa y en la cotización del portal.' : 'Solo letras, números y guiones.'}>
              <input
                id="emp-ruc"
                className={`mono ${rucOk ? '' : 'is-invalid'}`}
                value={f.COMPANY_RUC}
                onChange={(e) => set('COMPANY_RUC')(e.target.value.toUpperCase())}
                placeholder="J0310000000000"
                maxLength={30}
              />
            </Field>
          </div>
          <div className="form-grid">
            <Field label="Teléfono" htmlFor="emp-tel">
              <input id="emp-tel" value={f.COMPANY_PHONE} onChange={(e) => set('COMPANY_PHONE')(e.target.value)} placeholder="2222-0000" maxLength={40} />
            </Field>
            <Field label="WhatsApp" htmlFor="emp-wa" help="Con código de país, ej. 50588880000.">
              <input id="emp-wa" value={f.COMPANY_WHATSAPP} onChange={(e) => set('COMPANY_WHATSAPP')(e.target.value.replace(/[^\d+]/g, ''))} placeholder="50588880000" maxLength={20} />
            </Field>
          </div>
          <Field label="Correo" htmlFor="emp-correo">
            <input id="emp-correo" type="email" value={f.COMPANY_EMAIL} onChange={(e) => set('COMPANY_EMAIL')(e.target.value)} placeholder="ventas@suempresa.com" maxLength={150} />
          </Field>
          <Field label="Dirección" htmlFor="emp-dir">
            <textarea id="emp-dir" rows={2} value={f.COMPANY_ADDRESS} onChange={(e) => set('COMPANY_ADDRESS')(e.target.value)} maxLength={255} />
          </Field>
          <Field label="Horario de atención" htmlFor="emp-hor">
            <input id="emp-hor" value={f.COMPANY_HOURS} onChange={(e) => set('COMPANY_HOURS')(e.target.value)} placeholder="Lunes a viernes, 8:00 a. m. a 5:00 p. m." maxLength={120} />
          </Field>
        </section>
        <section className="adm-card-sec">
          <h2>Facturación</h2>
          <p className="muted-sm">Se aplican a las ventas y cotizaciones que se hagan desde ahora; las ya emitidas no cambian.</p>
          <Field label="Régimen de impuestos" htmlFor="emp-reg">
            <select id="emp-reg" value={f.TAX_REGIME} onChange={(e) => set('TAX_REGIME')(e.target.value)}>
              <option value="CUOTA_FIJA">Cuota fija (no se cobra IVA)</option>
              <option value="IVA">Régimen general (se cobra IVA)</option>
            </select>
          </Field>
          {f.TAX_REGIME === 'IVA' && (
            <Field label="Tasa de IVA (%)" htmlFor="emp-tasa" help={tasaOk ? 'En Nicaragua la tasa general es 15 %.' : 'Escriba un número entre 0 y 100.'}>
              <input id="emp-tasa" inputMode="numeric" value={f.TAX_RATE} onChange={(e) => set('TAX_RATE')(e.target.value.replace(/\D/g, ''))} maxLength={3} />
            </Field>
          )}
          <Field label="Plazo de crédito por omisión (días)" htmlFor="emp-dias" help={diasOk ? 'Se propone al vender a crédito; se puede cambiar en cada venta.' : 'Entre 1 y 365 días.'}>
            <input id="emp-dias" inputMode="numeric" value={f.CREDIT_TERM_DAYS} onChange={(e) => set('CREDIT_TERM_DAYS')(e.target.value.replace(/\D/g, ''))} maxLength={3} />
          </Field>
          <div className="note">
            <span className="ic">ℹ️</span>
            <div>Cambiar el régimen afecta cómo se calculan los impuestos de las ventas nuevas. Confírmelo con contabilidad antes de guardarlo.</div>
          </div>
        </section>
      </div>
    </>
  );
}
