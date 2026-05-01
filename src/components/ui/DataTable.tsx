import styles from "./DataTable.module.css";

// Tipos y Props

export interface ColumnaTabla<T> {
    key: string;
    label: string;
    width?: string;
    render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
    columnas: ColumnaTabla<T>[];
    datos: T[];
    keyExtractor: (item: T) => string;
    seleccionable?: boolean;
    seleccionados?: string[];
    onSeleccionar?: (keys: string[]) => void;
    vacio?: string;
    cargando?: boolean;
}

// Componente principal

export function DataTable<T>({
    columnas,
    datos,
    keyExtractor,
    seleccionable = false,
    seleccionados = [],
    onSeleccionar,
    vacio = "No hay datos",
    cargando = false,
}: DataTableProps<T>) {

const todosSeleccionados =
    datos.length > 0 && seleccionados.length === datos.length;

    function toggleTodos() {
        if (!onSeleccionar) return;
        if (todosSeleccionados) {
        onSeleccionar([]);
        } else {
        onSeleccionar(datos.map(keyExtractor));
        }
    }

    function toggleItem(key: string) {
        if (!onSeleccionar) return;
        if (seleccionados.includes(key)) {
        onSeleccionar(seleccionados.filter((k) => k !== key));
        } else {
        onSeleccionar([...seleccionados, key]);
        }
    }

    return (
        <div className={styles.wrapper}>
        <table className={styles.table}>
            {/* Encabezado */}
            <thead>
                <tr>
                {seleccionable && (
                    <th className={styles.checkboxCol}>
                    <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={todosSeleccionados}
                        onChange={toggleTodos}
                    />
                    </th>
                )}
                {columnas.map((col) => (
                    <th
                    key={col.key}
                    className={styles.headerCell}
                    style={{ width: col.width }}
                    >
                    {col.label}
                    </th>
                ))}
                </tr>
            </thead>

            {/* Cuerpo */}
            <tbody>
            {cargando ? (
                <tr>
                <td
                    colSpan={columnas.length + (seleccionable ? 1 : 0)}
                    className={styles.emptyCell}
                >
                    <div className={styles.skeletonWrapper}>
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className={styles.skeleton} />
                    ))}
                    </div>
                </td>
                </tr>
            ) : datos.length === 0 ? (
                <tr>
                <td
                    colSpan={columnas.length + (seleccionable ? 1 : 0)}
                    className={styles.emptyCell}
                >
                    <span className={styles.emptyText}>{vacio}</span>
                </td>
                </tr>
            ) : (
                datos.map((item) => {
                const key = keyExtractor(item);
                const seleccionado = seleccionados.includes(key);
                return (
                    <tr
                    key={key}
                    className={`${styles.row} ${seleccionado ? styles.rowSelected : ""}`}
                    >
                    {seleccionable && (
                        <td className={styles.checkboxCol}>
                        <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={seleccionado}
                            onChange={() => toggleItem(key)}
                        />
                        </td>
                    )}
                    {columnas.map((col) => (
                        <td key={col.key} className={styles.cell}>
                        {col.render
                            ? col.render(item)
                            : String((item as Record<string, unknown>)[col.key] ?? "—")}
                        </td>
                    ))}
                    </tr>
                );
                })
            )}
            </tbody>
        </table>
        </div>
    );
}