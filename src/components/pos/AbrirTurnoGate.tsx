"use client";

// src/components/pos/AbrirTurnoGate.tsx
//
// Envuelve cualquier vista de venta (MesasClient, MenuClient, etc.) y se
// encarga de abrir Y cerrar el turno de caja. Es la misma UI/lógica que ya
// vive dentro de MenuClient — se extrajo aquí porque MesasClient no la trae
// integrada (antes el empleado siempre pasaba primero por /empleado/menu,
// que sí la tiene).

import { useState }       from "react";
import { useRouter }      from "next/navigation";
import { Calculator, LogOut } from "lucide-react";
import { Modal, ModalField, ModalInput } from "@/components/ui/Modal";
import { ModalCerrarCaja } from "@/app/empleado/menu/ModalCerrarCaja";
import { iniciarTurno }   from "@/lib/actions/cortes";
import type { CorteCaja, VentasDelTurno } from "@/types";
import styles             from "@/app/empleado/menu/menu.module.css";

interface Props {
  tieneTurno:     boolean;
  corte:          CorteCaja | null;
  ventasDelTurno: VentasDelTurno;
  children:       React.ReactNode;
}

export function AbrirTurnoGate({ tieneTurno, corte, ventasDelTurno, children }: Props) {
  const router = useRouter();

  // ── Abrir turno ──────────────────────────────────────────────────────────
  const [modalTurno,   setModalTurno]   = useState(false);
  const [fondoInicial, setFondoInicial] = useState("");
  const [nombreTurno,  setNombreTurno]  = useState("");
  const [errorTurno,   setErrorTurno]   = useState<string | null>(null);
  const [loadingTurno, setLoadingTurno] = useState(false);

  async function handleIniciarTurno() {
    setErrorTurno(null);
    setLoadingTurno(true);
    const fd = new FormData();
    fd.append("eFondoInicial", fondoInicial);
    fd.append("tNombreTurno",  nombreTurno);
    const result = await iniciarTurno(fd);
    setLoadingTurno(false);
    if ("error" in result) setErrorTurno(result.error ?? null);
    else { setModalTurno(false); router.refresh(); }
  }

  // ── Cerrar caja ──────────────────────────────────────────────────────────
  const [modalCerrarCaja, setModalCerrarCaja] = useState(false);

  return (
    <>
      {!tieneTurno && (
        <div className={styles.bannerTurno}>
          <div className={styles.bannerTexto}>
            <Calculator size={18} className={styles.bannerIcono} />
            <div>
              <p className={styles.bannerTitulo}>No tienes un turno activo</p>
              <p className={styles.bannerSub}>Inicia tu turno para poder atender mesas</p>
            </div>
          </div>
          <button className={styles.bannerBtn} onClick={() => setModalTurno(true)}>
            Iniciar turno
          </button>
        </div>
      )}

      {tieneTurno && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-3)" }}>
          <button className={styles.btnCerrarCaja} onClick={() => setModalCerrarCaja(true)}>
            <LogOut size={15} />
            Cerrar caja
          </button>
        </div>
      )}

      {children}

      {modalTurno && (
        <Modal
          titulo="Iniciar turno"
          onCerrar={() => { setModalTurno(false); setErrorTurno(null); }}
          onConfirmar={handleIniciarTurno}
          labelConfirmar="Iniciar turno"
          labelCancelar="Cancelar"
          cargando={loadingTurno}
          deshabilitado={fondoInicial === ""}
          error={errorTurno}
        >
          <ModalField label="Fondo inicial en efectivo" required>
            <ModalInput
              type="number" min="0" step="0.01" placeholder="0.00"
              value={fondoInicial}
              onChange={(e) => setFondoInicial(e.target.value)}
              autoFocus
            />
          </ModalField>
          <ModalField label="Nombre del turno (opcional)">
            <ModalInput
              type="text" placeholder="Ej. Turno matutino"
              value={nombreTurno}
              onChange={(e) => setNombreTurno(e.target.value)}
            />
          </ModalField>
        </Modal>
      )}

      {tieneTurno && corte && modalCerrarCaja && (
        <ModalCerrarCaja
          corte={corte}
          ventasDelTurno={ventasDelTurno}
          onClose={() => setModalCerrarCaja(false)}
          onCerrado={() => { setModalCerrarCaja(false); router.refresh(); }}
        />
      )}
    </>
  );
}