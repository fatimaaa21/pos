// src/lib/email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function enviarCodigoEmail({
  nombre,
  email,
  codigo,
}: {
  nombre: string;
  email: string;
  codigo: string;
}) {
  const { error } = await resend.emails.send({
    from: "Panadería <no-reply@tudominio.com>",
    to: email,
    subject: "Tu código de acceso",
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
        <h2>Hola ${nombre} 👋</h2>
        <p>Tu cuenta en el sistema de la panadería ha sido creada.</p>
        <p>Tu código de acceso es:</p>
        <div style="
          font-size: 48px;
          font-weight: bold;
          letter-spacing: 12px;
          text-align: center;
          padding: 24px;
          background: #f8f7f4;
          border-radius: 12px;
          margin: 24px 0;
          color: #628321;
        ">
          ${codigo}
        </div>
        <p style="color: #888; font-size: 13px;">
          Guarda este código, lo necesitarás cada vez que inicies sesión.
        </p>
      </div>
    `,
  });

  return { ok: !error, error };
}