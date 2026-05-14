export type Rol = "admin" | "empleado";

export interface Perfil {
  eCodUser: string;
  tNameUser: string;
  tEmailUser: string;
  tRolUser: Rol;
  bStateUser: boolean;
  eCodeUser: string;
  fhCreateUser: string;
  fhUpdateUser?: string;
}

export interface Categoria {
  eCodCategory: string;
  tNameCategory: string;
  ImgCategory?: string;
  fhCreateCategory?: string;
  fhUpdateCategory?: string;
  bStateCategory?: boolean;
  productos?: ProductoResumen[];
}

export interface ProductoResumen {
  eCodProduct: string;
  tNameProduct: string;
  bStateProduct?: boolean;
  ePriceProduct: number;
}

export interface Producto {
  eCodProduct: string;
  tNameProduct: string;
  fkeCodCategory?: string;
  ePriceProduct: number;
  eCostProduct: number;
  ImgProduct?: string;
  bStateProduct?: boolean;
  fhCreateProduct?: string;
  fhUpdateProduct?: string;
}

// Producto enriquecido con stock calculado — exclusivo del menú del empleado
export interface ProductoConStock extends Producto {
  stockDisponible: number;  // suma de eCantRestante de todos los lotes activos
}

export interface Inventario {
  eCodInventory: string;
  fkeCodProduct: string;
  eCantIngresada: number;
  eCantVendida: number;
  eCantRestante: number;
  eStockMinimo: number;
  fhCreateInventory?: string;
  fhUpdateInventory?: string;
  bStateInventory?: boolean;
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