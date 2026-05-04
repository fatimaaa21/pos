// Es el contrato de datos que usan todos los demás archivos.
// Si la base de datos cambia, aquí se refleja primero.

export type Rol = "admin" | "empleado";

// Refleja exactamente las columnas de la tabla "perfiles" en Supabase
export interface Perfil {
  eCodUser: string;       // UUID, PK, linked to auth.users.id
  tNameUser: string;
  ImgUser?: string;
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
}

export interface Producto {
  eCodProduct: string;  // UUID, PK
  tNameProduct: string;
  fkeCodCategory?: Categoria;
  ePriceProduct: number;
  eCostProduct: number;
  ImgProduct?: string;
  bStateProduct?: boolean;
  fhCreateProduct?: string;
  fhUpdateProduct?: string;
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

export type EstadoStock = "disponible" | "bajo" | "agotado";

export function getEstadoStock(cantidad: number, minimo: number): EstadoStock {
  if (cantidad === 0) return "agotado";
  if (cantidad <= minimo) return "bajo";
  return "disponible";
}