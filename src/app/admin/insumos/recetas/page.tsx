import { obtenerPresentacionesConReceta } from "@/lib/actions/receta-insumos";
import { RecetasClient } from "./RecetasClient";

export default async function RecetasPage() {
  const presentaciones = await obtenerPresentacionesConReceta();
  return <RecetasClient presentaciones={presentaciones} />;
}