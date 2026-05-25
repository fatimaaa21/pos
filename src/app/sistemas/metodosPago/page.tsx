import { getMetodosPagoGlobal } from "@/lib/actions/metodos-pago";
import { MetodosPagoClient }   from "./metodosPagoClient";

export default async function MetodosPagoPage() {
  const metodos = await getMetodosPagoGlobal();
  return <MetodosPagoClient metodos={metodos} />;
}