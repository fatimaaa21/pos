export type ImgCategoryParsed =
  | { tipo: "icono"; key: string }
  | { tipo: "imagen"; url: string }
  | { tipo: "vacio" };

export function parseImgCategory(value: string | null | undefined): ImgCategoryParsed {
  if (!value || value.trim() === "") return { tipo: "vacio" };
  if (value.startsWith("icon:")) return { tipo: "icono", key: value.slice(5) };
  if (value.startsWith("http")) return { tipo: "imagen", url: value };
  return { tipo: "vacio" };
}