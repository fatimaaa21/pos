import { obtenerAutoconsumoAdmin } from "@/lib/actions/autoconsumo";
import { AutoconsumoAdminClient } from "./AutoconsumoAdminClient";

export default async function AutoconsumoAdminPage() {
  const registros = await obtenerAutoconsumoAdmin();
  return <AutoconsumoAdminClient registros={registros} />;
}
