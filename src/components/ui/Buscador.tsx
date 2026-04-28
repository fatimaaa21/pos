"use client";

import { Search } from "lucide-react";
import styles from "./Buscador.module.css";

interface BuscadorProps {
  valor: string;
  onChange: (valor: string) => void;
  placeholder?: string;
}

export function Buscador({ valor, onChange }: BuscadorProps) {
  return (
    <div className={styles.wrapper}>
      <Search size={18} className={styles.icon} />
      <input
        className={styles.input}
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar..."
      />
    </div>
  );
}