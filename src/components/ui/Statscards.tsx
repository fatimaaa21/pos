import styles from "./Statscards.module.css";

export interface StatItem {
  label: string;
  value: number | string;
  variante?: "primary" | "success" | "warning" | "error" | "accent" | "neutral";
}

interface StatCardsProps {
  stats: StatItem[];
}

const VARIANTE_COLOR: Record<NonNullable<StatItem["variante"]>, string> = {
  primary: "var(--color-primary)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  error:   "var(--color-error)",
  accent:  "var(--color-accent)",
  neutral: "var(--gray)",
};

export function StatCards({ stats }: StatCardsProps) {
  return (
    <div className={styles.grid}>
      {stats.map((stat) => {
        const color = VARIANTE_COLOR[stat.variante ?? "primary"];
        return (
          <div key={stat.label} className={styles.card}>
            <div className={styles.valor} style={{ color }}>
              {stat.value}
            </div>
            <div className={styles.label}>{stat.label}</div>
          </div>
        );
      })}
    </div>
  );
}