"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Categoria } from "@/types";
import { IconoCategoria } from "@/components/ui/IconoCategoria";
import styles from "./CategoriaCarrusel.module.css";

interface Props {
  categorias: Categoria[];
  categoriaActiva: string;
  conteoPorCategoria: Record<string, number>;
  onSeleccionar: (id: string) => void;
}

// Icono genérico cuando la categoría no tiene imagen
function IconoCaja() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  );
}

// Categoría "Todos" sintética que siempre va primero
const TODOS: Categoria = {
  eCodCategory: "todas",
  tNameCategory: "Todos",
  bStateCategory: true,
  fkeCodCompany: "",
};

export function CategoriaCarrusel({
  categorias,
  categoriaActiva,
  conteoPorCategoria,
  onSeleccionar,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scroll(dir: "left" | "right") {
    trackRef.current?.scrollBy({
      left: dir === "left" ? -220 : 220,
      behavior: "smooth",
    });
  }

  const todas = [TODOS, ...categorias];

  return (
    <div className={styles.wrapper}>
      <button
        className={styles.flecha}
        onClick={() => scroll("left")}
        aria-label="Desplazar izquierda"
      >
        <ChevronLeft size={16} />
      </button>

      <div className={styles.track} ref={trackRef}>
        {todas.map((cat) => {
          const activa = cat.eCodCategory === categoriaActiva;
          const conteo = conteoPorCategoria[cat.eCodCategory] ?? 0;

          return (
            <button
              key={cat.eCodCategory}
              className={`${styles.card} ${activa ? styles.cardActiva : ""}`}
              onClick={() => onSeleccionar(cat.eCodCategory)}
            >
              <div className={`${styles.iconWrap} ${activa ? styles.iconWrapActiva : ""}`}>
                <IconoCategoria
                  value={cat.ImgCategory}
                  size={48}
                  color={activa ? "var(--color-primary-dark)" : "var(--color-primary)"}
                />
              </div>
              <div className={styles.textos}>
                <span className={styles.nombre}>{cat.tNameCategory}</span>
                <span className={styles.conteo}>{conteo} productos</span>
              </div>
            </button>
          );
        })}
      </div>

      <button
        className={styles.flecha}
        onClick={() => scroll("right")}
        aria-label="Desplazar derecha"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}