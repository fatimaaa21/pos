import { Loader2 } from "lucide-react";

interface Props {
  size?: number;
}

export function Spinner({ size = 16 }: Props) {
  return (
    <Loader2
      size={size}
      strokeWidth={2.5}
      style={{ animation: "spin 0.7s linear infinite", alignItems: "center" }}
    />
  );
}