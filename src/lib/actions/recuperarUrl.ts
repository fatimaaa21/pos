"use server";

import { Resend } from "resend";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarBloqueoBusqueda, registrarBusqueda } from "@/lib/utils/negocioAttempts";

const resend = new Resend(process.env.RESEND_API_KEY);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function obtenerIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "desconocida";
}

const RESPUESTA_MINIMA_MS = 400;

// Mensaje SIEMPRE igual, exista o no el correo como admin — de lo contrario,
// esta pantalla se convierte en un oráculo para confirmar qué correos son
// administradores de qué negocios en Kivi.
const MENSAJE_GENERICO =
  "Si ese correo está registrado como administrador de un negocio en Kivi, te enviamos la URL de acceso.";

async function enviarCorreoRecuperacion(nombreNegocio: string, email: string, slug: string) {
  const url = `https://kivi.mx/auth/login/${slug}`;
  await resend.emails.send({
    from: "Kivi <no-reply@kivi.mx>",
    to: email,
    subject: `URL de acceso de ${nombreNegocio}`,
    html: `
      <div style="font-family: Sora, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #f8f7f4;">
        <div style="background: white; border-radius: 20px; padding: 40px; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
          <div style="text-align: center; margin-bottom: 32px;">
            <img
              src="https://kivi.mx/icons/Isotipo-192.png"
              alt="Kivi"
              width="56"
              height="56"
              style="display: block; margin: 0 auto 12px; border-radius: 14px;"
            />
            <h1 style="font-size: 22px; color: #1a1a1a; margin: 0 0 8px;">URL de acceso de ${nombreNegocio}</h1>
            <p style="color: #7a6a5e; font-size: 14px; margin: 0;">Guarda este enlace en el dispositivo de tu negocio</p>
          </div>
          <div style="background: #f0f5e8; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 28px;">
            <a href="${url}" style="color: #628321; font-size: 15px; font-weight: 600; word-break: break-all;">${url}</a>
          </div>
          <div style="background: #fef3e8; border-radius: 12px; padding: 16px; margin-bottom: 28px;">
            <p style="color: #a86530; font-size: 13px; margin: 0;">🔒 Si tú no solicitaste este correo, puedes ignorarlo con confianza, tu código de acceso no cambió.</p>
          </div>
          <p style="color: #9a8a7e; font-size: 12px; text-align: center; margin: 0;">Kivi · Sistema de punto de venta</p>
        </div>
      </div>
    `,
  });
}

export async function recuperarUrlPorCorreo(email: string) {
  const ip = await obtenerIp();

  // Reutiliza el mismo límite de intentos que /auth/negocio — mismo tipo de
  // abuso potencial (automatizar muchos intentos), aquí además con costo
  // real de envío de correo si no se limitara.
  const bloqueo = await verificarBloqueoBusqueda(ip);
  if (bloqueo.bloqueado) {
    return { error: bloqueo.motivo };
  }
  if (bloqueo.delayMs > 0) {
    await sleep(bloqueo.delayMs);
  }

  const inicio = Date.now();
  const correo = email.trim().toLowerCase();

  if (!correo) {
    return { error: "Escribe tu correo electrónico" };
  }

  await registrarBusqueda(ip);

  const adminClient = createAdminClient();
  const { data: perfil } = await adminClient
    .from("perfiles")
    .select("fkeCodCompany, tRolUser, bStateUser")
    .eq("tEmailUser", correo)
    .eq("tRolUser", "admin")
    .eq("bStateUser", true)
    .maybeSingle();

  if (perfil?.fkeCodCompany) {
    const { data: negocio } = await adminClient
      .from("negocios")
      .select("tNameCompany, tSlugCompany, bStateCompany")
      .eq("eCodCompany", perfil.fkeCodCompany)
      .maybeSingle();

    if (negocio && negocio.bStateCompany === "activo") {
      try {
        await enviarCorreoRecuperacion(negocio.tNameCompany, correo, negocio.tSlugCompany);
      } catch (emailError) {
        console.error("Error enviando correo de recuperación:", emailError);
        // No se revela al usuario si el envío falló — mismo mensaje genérico,
        // para no delatar si el correo existía o no según si hubo error.
      }
    }
  }

  // Normaliza el tiempo de respuesta, mismo motivo que en /auth/negocio.
  const transcurrido = Date.now() - inicio;
  if (transcurrido < RESPUESTA_MINIMA_MS) {
    await sleep(RESPUESTA_MINIMA_MS - transcurrido);
  }

  return { ok: true, mensaje: MENSAJE_GENERICO };
}