import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error("Falta STRIPE_SECRET_KEY en las variables de entorno");
}

// apiVersion fijo a propósito: si Stripe libera una versión nueva de su API,
// no queremos que este proyecto empiece a hablarle a una versión distinta
// sin que alguien lo decida explícitamente y pruebe el cambio.
export const stripe = new Stripe(secretKey, {
  apiVersion: "2026-08-26.dahlia",
  typescript: true,
});