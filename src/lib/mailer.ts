import { Resend } from 'resend';

// 1. Iniciamos Resend con la clave del .env
export const resend = new Resend(process.env.RESEND_API_KEY);

// 2. Definimos quién envía el correo
// IMPORTANTE:
// - Al principio, si tus DNS no se han propagado, puede que rebote si usas tu dominio.
// - Si te da error de "domain not verified", cambia temporalmente el email de abajo por: 'onboarding@resend.dev'
export const MAIL_FROM = 'Soporte Blue Team <soporte@blue7eamalumnas.com>';