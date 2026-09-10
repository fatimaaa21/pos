"use client";

// src/components/pos/AbrirTurnoGate.tsx
//
// Envuelve cualquier vista de venta (MesasClient, MenuClient, etc.) y se
// encarga de abrir Y cerrar el turno de caja. Es la misma UI/lógica que ya
// vive dentro de MenuClient — se extrajo aquí porque MesasClient no la trae
// integrada (antes el empleado siempre pasaba primero por /empleado/menu,
// que sí la tiene).

import { useState, createContext, useContext } from "react";
import React              from "react";
import { useRouter }      from "next/navigation";
import { Calculator, LogOut } from "lucide-react";
import { Modal, ModalField, ModalInput } from "@/components/ui/Modal";
import { ModalCerrarCaja } from "@/app/empleado/menu/ModalCerrarCaja";
import { iniciarTurno }   from "@/lib/actions/cortes";
import type { CorteCaja, VentasDelTurno } from "@/types";
import type { MetodoPagoGlobal }          from "@/lib/actions/metodos-pago";
import styles             from "@/app/empleado/menu/menu.module.css";

interface Props {
  tieneTurno:     boolean;
  corte:          CorteCaja | null;
  ventasDelTurno: VentasDelTurno;
  metodosPago:    MetodoPagoGlobal[];
  children:       React.ReactNode;
}

// ── Context para "cerrar caja" ──────────────────────────────────────────────
// No usamos React.cloneElement para inyectar este callback en `children`:
// `children` aquí viene de un Server Component (admin/menu/page.tsx y
// empleado/menu/page.tsx lo arman con `await` antes de pasarlo), y clonar un
// elemento que cruzó esa frontera server→client rompe su referencia interna
// (el error "Element type is invalid" que ya cazamos). Context sí es seguro
// porque se lee del lado del cliente, después de la hidratación.
const CerrarCajaContext = createContext<(() => void) | null>(null);

export function useCerrarCaja() {
  return useContext(CerrarCajaContext);
}

export function AbrirTurnoGate({ tieneTurno, corte, ventasDelTurno, metodosPago, children }: Props) {
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
    <CerrarCajaContext.Provider value={tieneTurno ? () => setModalCerrarCaja(true) : null}>
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
          metodosPago={metodosPago}
          onClose={() => setModalCerrarCaja(false)}
          onCerrado={() => { setModalCerrarCaja(false); router.refresh(); }}
        />
      )}
    </CerrarCajaContext.Provider>
  );
}