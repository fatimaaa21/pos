import { parseImgCategory } from "@/lib/utils/img-category";
import { ICONOS_CATEGORIAS } from "@/components/icons/categorias-iconos";

interface Props {
  value: string | null | undefined;
  size?: number;
  color?: string;
}

function FallbackIcono({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  );
}

export function IconoCategoria({ value, size = 28, color }: Props) {
  const parsed = parseImgCategory(value);

  if (parsed.tipo === "imagen") {
    return (
      <img
        src={parsed.url}
        alt=""
        style={{ width: size, height: size, objectFit: "cover" }}
      />
    );
  }

  if (parsed.tipo === "icono") {
    const item = ICONOS_CATEGORIAS.find((i) => i.key === parsed.key);
    if (!item) return <FallbackIcono size={size} />;

    if (item.tipo === "lucide" || item.tipo === "custom") {
        return <item.Icon size={size} strokeWidth={1.5} color={color} />;
    }
  }

  return <FallbackIcono size={size} />;
}