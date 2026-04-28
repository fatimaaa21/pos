import styles from "./PageHeader.module.css";
import {Plus} from "lucide-react";

interface PageHeaderProps {
  titulo: string;
  descripcion?: string;
  boton?: {
    label: string;
    onClick: () => void;
    icon?: string;
  };
}

export function PageHeader({ titulo, descripcion, boton }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <div>
        <h1 className={styles.titulo}>{titulo}</h1>
        {descripcion && <p className={styles.descripcion}>{descripcion}</p>}
      </div>
      {boton && (
        <button className={styles.boton} onClick={boton.onClick}>
          <span className={styles.botonIcon}>{boton.icon ?? <Plus size={18}/>}</span>
          {boton.label}
        </button>
      )}
    </div>
  );
}