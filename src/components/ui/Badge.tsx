import styles from "./Badge.module.css";

type Variante =
  | "activo"
  | "inactivo"
  | "sistemas"
  | "admin"
  | "empleado"
  | "pendiente"
  | "publicado"
  | "bloqueado"
  | "bajo"
  | "agotado"
  | "disponible"
  | "categoria";

interface BadgeProps {
  variante?: Variante;
  activo?: boolean;
  children?: React.ReactNode;
  dot?: boolean;
  onToggle?: () => void;
  toggling?: boolean;
}

const CONFIG: Record<Variante, { label: string; clase: string }> = {
  activo:      { label: "Activo",      clase: styles.activo },
  inactivo:    { label: "Inactivo",    clase: styles.inactivo },
  sistemas:    { label: "Sistemas",    clase: styles.sistemas },
  admin:       { label: "Admin",       clase: styles.admin },
  empleado:    { label: "Empleado",    clase: styles.empleado },
  pendiente:   { label: "Pendiente",   clase: styles.pendiente },
  publicado:   { label: "Publicado",   clase: styles.publicado },
  bloqueado:   { label: "Bloqueado",   clase: styles.bloqueado },
  bajo:        { label: "Stock bajo",  clase: styles.bajo },
  agotado:     { label: "Agotado",     clase: styles.agotado },
  disponible:  { label: "Disponible",  clase: styles.disponible },
  categoria:  { label: "",           clase: styles.categoria },
};

export function Badge({ variante, activo, children, dot = true, onToggle, toggling }: BadgeProps) {
  const v: Variante = variante ?? (activo === true ? "activo" : activo === false ? "inactivo" : "activo");
  const config = CONFIG[v];

  const content = (
    <>
      {dot && <span className={styles.dot} />}
      {toggling ? "..." : (children ?? config.label)}
    </>
  );

  if (onToggle) {
    return (
      <button
        onClick={onToggle}
        disabled={toggling}
        className={`${styles.badge} ${config.clase} ${styles.togglable}`}
        title={v === "activo" ? "Clic para desactivar" : "Clic para activar"}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={`${styles.badge} ${config.clase}`}>
      {content}
    </span>
  );
}