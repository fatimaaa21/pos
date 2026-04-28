import styles from "./Badge.module.css";

// ─── Variantes predefinidas ──────────────────────────────────────────────────

type Variante =
  | "activo"
  | "inactivo"
  | "admin"
  | "empleado"
  | "pendiente"
  | "publicado"
  | "bloqueado"
  | "bajo"
  | "agotado"
  | "disponible";

interface BadgeProps {
  variante?: Variante;
  activo?: boolean;       // atajo: true → "activo", false → "inactivo"
  children?: React.ReactNode;
  dot?: boolean;          // muestra el punto indicador
}

const CONFIG: Record<Variante, { label: string; clase: string }> = {
  activo:      { label: "Activo",      clase: styles.activo },
  inactivo:    { label: "Inactivo",    clase: styles.inactivo },
  admin:       { label: "Admin",       clase: styles.admin },
  empleado:    { label: "Empleado",    clase: styles.empleado },
  pendiente:   { label: "Pendiente",   clase: styles.pendiente },
  publicado:   { label: "Publicado",   clase: styles.publicado },
  bloqueado:   { label: "Bloqueado",   clase: styles.bloqueado },
  bajo:        { label: "Stock bajo",  clase: styles.bajo },
  agotado:     { label: "Agotado",     clase: styles.agotado },
  disponible:  { label: "Disponible",  clase: styles.disponible },
};

export function Badge({ variante, activo, children, dot = true }: BadgeProps) {
  // Si pasan "activo" como booleano, lo convertimos a variante
  const v: Variante = variante ?? (activo === true ? "activo" : activo === false ? "inactivo" : "activo");
  const config = CONFIG[v];

  return (
    <span className={`${styles.badge} ${config.clase}`}>
      {dot && <span className={styles.dot} />}
      {children ?? config.label}
    </span>
  );
}