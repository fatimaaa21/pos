export type Rol = "admin" | "empleado" | "sistemas";

export interface Perfil {
  fkeCodCompany: string | null;
  eCodUser: string;
  tNameUser: string;
  tEmailUser: string;
  tRolUser: Rol;
  bStateUser: boolean;
  eCodeUser: string;
  fhCreateUser: string;
  fhUpdateUser?: string;
}

export interface Negocio {
  eCodCompany: string;
  tNameCompany: string;
  tSlugCompany: string;
  imgCompany?: string;
  moneda: string;
  zona_horaria: string;
  bstateCompany: boolean;
  fhCreateCompany: string;
}

export interface Categoria {
  fkeCodCompany: string;
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
  fkeCodCompany: string;
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

export interface Inventario {
  fkeCodCompany: string;
  eCodInventory: string;
  fkeCodProduct: string;
  eCantIngresada: number | null;
  eCantVendida: number;
  eCantRestante: number | null;
  eStockMinimo: number | null;
  bUnlimitedInventory: boolean;
  fhCreateInventory?: string;
  fhUpdateInventory?: string;
  bStateInventory?: boolean;
}

export type EstadoStock = "disponible" | "bajo" | "agotado" | "ilimitado";

export function getEstadoStock(
  restante: number | null,
  minimo: number | null,
  ilimitado?: boolean
): EstadoStock {
  if (ilimitado) return "ilimitado";
  if (restante === null) return "ilimitado";
  if (restante === 0) return "agotado";
  if (minimo !== null && restante <= minimo) return "bajo";
  return "disponible";
}

export interface ProductoConStock {
  eCodProduct: string;
  tNameProduct: string;
  fkeCodCategory?: string;
  ePriceProduct: number;
  ImgProduct?: string;
  stockDisponible: number;
  bIlimitado?: boolean;
}

export type MetodoPago = string;

export interface Venta {
  fkeCodCompany: string;
  eCodVenta: string;
  fkeCodUser: string;
  empleado?: Perfil;
  eTotal: number;
  fkeMetodoPago: MetodoPago;
  metodoPagoNombre: string;
  metodoPagoIcono?: string | null;
  fhCreateVenta: string;
}

export interface DetalleVenta {
  eCodDetalle: string;
  fkeCodVenta: string;
  fkeCodProduct: string;
  producto?: Producto;
  eCantidad: number;
  ePrecioUnitario: number;
  eSubtotal: number;
}

export interface ItemCarrito {
  producto: Producto & { cantidad_disponible: number };
  cantidad: number;
  subtotal: number;
}