import styles from "./Tabla.module.css";

interface Columna<T> {
  header: string;
  accessor?: keyof T;
  render?: (fila: T) => React.ReactNode;
  width?: string;
}

interface TablaProps<T> {
  columnas: Columna<T>[];
  datos: T[];
  loading?: boolean;
  mensajeVacio?: string;
  keyExtractor: (fila: T) => string | number;
}

export function Tabla<T>({
  columnas,
  datos,
  loading = false,
  mensajeVacio = "No se encontraron resultados",
  keyExtractor,
}: TablaProps<T>) {
  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.cargando}>Cargando...</div>
      </div>
    );
  }

  if (datos.length === 0) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.vacio}>{mensajeVacio}</div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.tabla}>
        <thead>
          <tr>
            {columnas.map((col, i) => (
              <th key={i} style={{ width: col.width }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {datos.map((fila) => (
            <tr key={keyExtractor(fila)}>
              {columnas.map((col, i) => (
                <td key={i}>
                  {col.render
                    ? col.render(fila)
                    : col.accessor
                    ? String(fila[col.accessor] ?? "")
                    : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}