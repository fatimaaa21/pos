import { obtenerPresentacionesConReceta, obtenerOpcionesConReceta } from "@/lib/actions/receta-insumos";
import { RecetasClient } from "./RecetasClient";

export default async function RecetasPage() {
  const [presentaciones, opciones] = await Promise.all([
    obtenerPresentacionesConReceta(),
    obtenerOpcionesConReceta(),
  ]);
  return <RecetasClient presentaciones={presentaciones} opciones={opciones} />;
}