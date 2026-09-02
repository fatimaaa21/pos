import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface Props {
  nombre: string;
  email: string;
  codigo: string;
  /** URL fija de acceso al negocio. Si se omite, el correo solo muestra el código. */
  url?: string;
}

export async function enviarEmailBienvenida({ nombre, email, codigo, url }: Props) {
  await resend.emails.send({
    from: "Kivi <no-reply@kivi.mx>",
    to: email,
    subject: "Tu código de acceso a Kivi",
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
            <h1 style="font-size: 22px; color: #1a1a1a; margin: 0 0 8px;">¡Bienvenido, ${nombre}!</h1>
            <p style="color: #7a6a5e; font-size: 14px; margin: 0;">Ya tienes acceso al sistema de gestión</p>
          </div>
          <div style="background: #f0f5e8; border-radius: 16px; padding: 28px; text-align: center; margin-bottom: 28px;">
            <p style="color: #628321; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 12px;">Tu código de acceso</p>
            <div style="font-size: 48px; font-weight: 700; color: #1a1a1a; letter-spacing: 16px; font-family: monospace;">${codigo}</div>
            <p style="color: #9a8a7e; font-size: 12px; margin: 12px 0 0;">Usa este código de 4 dígitos para iniciar sesión</p>
          </div>
          ${
            url
              ? `
          <div style="background: #f0f5e8; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 28px;">
            <p style="color: #628321; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 10px;">URL de acceso de tu negocio</p>
            <a href="${url}" style="color: #1a1a1a; font-size: 14px; font-weight: 600; word-break: break-all;">${url}</a>
            <p style="color: #9a8a7e; font-size: 12px; margin: 10px 0 0;">Guarda este enlace en el dispositivo de tu negocio</p>
          </div>
          `
              : ""
          }
          <div style="background: #fef3e8; border-radius: 12px; padding: 16px; margin-bottom: 28px;">
            <p style="color: #a86530; font-size: 13px; margin: 0;">🔒 <strong>Mantén este código seguro.</strong> No lo compartas con nadie fuera de tu equipo.</p>
          </div>
          <p style="color: #9a8a7e; font-size: 12px; text-align: center; margin: 0;">Kivi · Sistema de punto de venta</p>
        </div>
      </div>
    `,
  });
}