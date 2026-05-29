import styles from "./Badge.module.css";

// Variantes en uso real en el proyecto.
// Cualquier variante aquí DEBE tener su clase CSS correspondiente.
type Variante =
  | "activo"    // activo/inactivo — toggle de estado
  | "inactivo"
  | "sistemas"  // rol: sistemas
  | "admin"     // rol: admin
  | "empleado"  // rol: empleado / "En turno"
  | "pendiente" // estado amarillo: pendiente de revisión
  | "bajo"      // stock bajo
  | "agotado"   // stock agotado / neutral
  | "disponible"// stock disponible
  | "ilimitado" // stock ilimitado
  | "categoria" // badge de categoría (acento)
  | "error";    // diferencia / error (rojo)

interface BadgeProps {
  variante?: Variante;
  activo?: boolean;
  children?: React.ReactNode;
  dot?: boolean;
  onToggle?: () => void;
  toggling?: boolean;
}

const CONFIG: Record<Variante, { label: string; clase: string }> = {
  activo:     { label: "Activo",     clase: styles.activo    },
  inactivo:   { label: "Inactivo",   clase: styles.inactivo  },
  sistemas:   { label: "Sistemas",   clase: styles.sistemas  },
  admin:      { label: "Admin",      clase: styles.admin     },
  empleado:   { label: "Empleado",   clase: styles.empleado  },
  pendiente:  { label: "Pendiente",  clase: styles.pendiente },
  bajo:       { label: "Stock bajo", clase: styles.bajo      },
  agotado:    { label: "Agotado",    clase: styles.agotado   },
  disponible: { label: "Disponible", clase: styles.disponible},
  ilimitado:  { label: "Ilimitado",  clase: styles.ilimitado },
  categoria:  { label: "",           clase: styles.categoria },
  error:      { label: "Error",      clase: styles.error     },
};

export function Badge({
  variante,
  activo,
  children,
  dot = true,
  onToggle,
  toggling,
}: BadgeProps) {
  const v: Variante =
    variante ?? (activo === true ? "activo" : activo === false ? "inactivo" : "activo");

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