// Es el contrato de datos que usan todos los demás archivos.
// Si la base de datos cambia, aquí se refleja primero.

export type Rol = "admin" | "empleado";

// Refleja exactamente las columnas de la tabla "perfiles" en Supabase
export interface Perfil {
  eCodUser: string;       // UUID, PK, linked to auth.users.id
  tNameUser: string;
  tEmailUser: string;
  tRolUser: Rol;
  bStateUser: boolean;
  eCodeUser: string;      // Código de 4 dígitos para login
  fhCreateUser: string;
  fhUpdateUser?: string;
}

export interface Categoria {
  eCodCategory: string;    // UUID, PK
  tNameCategory: string;
  ImgCategory?: string;
  fhCreateCategory?: string;
  fhUpdateCategory?: string;
  bStateCategory?: boolean;
  // Relación hydratada desde el join en page.tsx
  productos?: ProductoResumen[];
}

// Versión ligera de Producto para mostrar dentro de una categoría
export interface ProductoResumen {
  eCodProduct: string;
  tNameProduct: string;
  bStateProduct?: boolean;
  ePriceProduct: number;
}

export interface Producto {
  eCodProduct: string;  // UUID, PK
  tNameProduct: string;
  fkeCodCategory?: string;   // FK — UUID de la categoría
  ePriceProduct: number;
  eCostProduct: number;
  ImgProduct?: string;
  bStateProduct?: boolean;
  fhCreateProduct?: string;
  fhUpdateProduct?: string;
}

export interface Inventario {
  eCodInventory:     string;       // UUID PK
  fkeCodProduct:     string;       // UUID FK → productos
  producto?:         Producto;     // join opcional
  eCantIngresada:    number;
  eCantVendida:      number;
  eCantRestante:     number;
  eStockMinimo:      number;
  bStateInventory:   boolean;
  fhCreateInventory: string;
  fhUpdateInventory?: string;
}
 
export type EstadoStock = "disponible" | "bajo" | "agotado";
 
export function getEstadoStock(restante: number, minimo: number): EstadoStock {
  if (restante === 0) return "agotado";
  if (restante <= minimo) return "bajo";
  return "disponible";
}

export interface Existencia {
  id: number;
  producto_id: number;
  producto?: Producto;
  cantidad: number;
  stock_minimo: number;
  actualizado_at: string;
}

export type MetodoPago = "efectivo" | "transferencia" | "tarjeta";

export interface Venta {
  id: number;
  empleado_id: string;
  empleado?: Perfil;
  total: number;
  metodo_pago: MetodoPago;
  created_at: string;
}

export interface DetalleVenta {
  id: number;
  venta_id: number;
  producto_id: number;
  producto?: Producto;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface ItemCarrito {
  producto: Producto & { cantidad_disponible: number };
  cantidad: number;
  subtotal: number;
}