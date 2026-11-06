/* =====================================================================
   Parámetros de seguridad del inicio de sesión.
   El frontend los usa para la experiencia (contadores, avisos); el
   backend NestJS debe aplicar los mismos límites, porque cualquier
   control que solo vive en el navegador se puede saltar.
   ===================================================================== */

/** Minutos sin actividad antes de cerrar la sesión automáticamente. */
export const SESSION_IDLE_MINUTES = 15;

/** Longitudes máximas aceptadas en el formulario. */
/** Usuario (hasta 50) o correo (hasta 150). */
export const USERNAME_MAX = 150;
export const PASSWORD_MAX = 128;

/**
 * Muestra el panel "Cuentas de prueba" en el login.
 * Visible en desarrollo (npm run dev) o si VITE_DEMO_ACCOUNTS=true.
 * Debe quedar apagado en cualquier despliegue real.
 */
export const SHOW_DEMO_ACCOUNTS = import.meta.env.DEV || import.meta.env.VITE_DEMO_ACCOUNTS === 'true';

/** Clave de localStorage para "Recordar mi usuario" (solo guarda el nombre de usuario, nunca la contraseña). */
export const REMEMBER_USER_KEY = 'siven.lastUser';

/* ---------- Recuperación de contraseña ---------- */

/** Dígitos del código que se envía por correo. */
export const RESET_CODE_LENGTH = 6;

/** Minutos de vigencia del código. */
export const RESET_CODE_TTL_MINUTES = 10;

/** Segundos de espera para reenviar un código. */
export const RESET_RESEND_SECONDS = 60;

/** Longitud mínima de una contraseña nueva. */
export const PASSWORD_MIN = 10;
