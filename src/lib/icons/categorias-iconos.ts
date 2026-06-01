import type { LucideIcon } from "lucide-react";
import {
  Coffee, Utensils, UtensilsCrossed, ChefHat,
  ShoppingBag, ShoppingCart, Package, Box, Tag,
  Star, Flame, Apple, Leaf, Droplets, Gift, Heart,
  Fish, Wine, Beer, IceCream, Cake, Cookie,
  Wheat, Milk, Pizza, Sandwich, Salad,
} from "lucide-react";

interface IconoLucide {
  key: string;
  label: string;
  tipo: "lucide";
  Icon: LucideIcon;
}

interface IconoCustom {
  key: string;
  label: string;
  tipo: "custom";
  src: string; // ruta desde /public, ej: "/icons/categorias/pan-dulce.svg"
}

export type IconoItem = IconoLucide | IconoCustom;

export const ICONOS_CATEGORIAS: IconoItem[] = [
  // ── Bebidas ──
  { key: "coffee",   label: "Café",      tipo: "lucide", Icon: Coffee },
  { key: "beer",     label: "Cerveza",   tipo: "lucide", Icon: Beer },
  { key: "wine",     label: "Vino",      tipo: "lucide", Icon: Wine },
  { key: "droplets", label: "Bebidas",   tipo: "lucide", Icon: Droplets },
  { key: "milk",     label: "Lácteos",   tipo: "lucide", Icon: Milk },

  // ── Comida ──
  { key: "utensils",        label: "Platillos", tipo: "lucide", Icon: Utensils },
  { key: "utensilsCrossed", label: "Comida",    tipo: "lucide", Icon: UtensilsCrossed },
  { key: "chefHat",         label: "Chef",      tipo: "lucide", Icon: ChefHat },
  { key: "pizza",           label: "Pizza",     tipo: "lucide", Icon: Pizza },
  { key: "sandwich",        label: "Sándwich",  tipo: "lucide", Icon: Sandwich },
  { key: "salad",           label: "Ensaladas", tipo: "lucide", Icon: Salad },
  { key: "fish",            label: "Pescado",   tipo: "lucide", Icon: Fish },

  // ── Panadería / Dulces ──
  { key: "cake",    label: "Pastel",    tipo: "lucide", Icon: Cake },
  { key: "cookie",  label: "Galletas",  tipo: "lucide", Icon: Cookie },
  { key: "wheat",   label: "Panadería", tipo: "lucide", Icon: Wheat },
  { key: "iceCream",label: "Helado",    tipo: "lucide", Icon: IceCream },

  // ── Frutas / Vegetales ──
  { key: "apple", label: "Frutas",    tipo: "lucide", Icon: Apple },
  { key: "leaf",  label: "Vegetales", tipo: "lucide", Icon: Leaf },

  // ── General ──
  { key: "shoppingBag",  label: "Tienda",    tipo: "lucide", Icon: ShoppingBag },
  { key: "shoppingCart", label: "Carrito",   tipo: "lucide", Icon: ShoppingCart },
  { key: "package",      label: "Paquete",   tipo: "lucide", Icon: Package },
  { key: "box",          label: "Caja",      tipo: "lucide", Icon: Box },
  { key: "tag",          label: "Etiqueta",  tipo: "lucide", Icon: Tag },
  { key: "gift",         label: "Regalo",    tipo: "lucide", Icon: Gift },
  { key: "star",         label: "Destacados",tipo: "lucide", Icon: Star },
  { key: "flame",        label: "Popular",   tipo: "lucide", Icon: Flame },
  { key: "heart",        label: "Favoritos", tipo: "lucide", Icon: Heart },

  // ── Íconos diseñados por ti ──
  // Agrega tus SVGs en /public/icons/categorias/ y añade entradas aquí:
  // { key: "pan-dulce", label: "Pan Dulce", tipo: "custom", src: "/icons/categorias/pan-dulce.svg" },
];