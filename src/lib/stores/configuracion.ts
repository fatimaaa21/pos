// src/lib/stores/configuracion.ts
import { create } from "zustand";

interface ConfiguracionStore {
  abierta: boolean;
  abrir:   () => void;
  cerrar:  () => void;
}

export const useConfiguracionStore = create<ConfiguracionStore>((set) => ({
  abierta: false,
  abrir:   () => set({ abierta: true  }),
  cerrar:  () => set({ abierta: false }),
}));