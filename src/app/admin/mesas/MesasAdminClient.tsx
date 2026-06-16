"use client";

import { useState, useTransition } from "react";
import toast                        from "react-hot-toast";
import { LayoutGrid, Power }        from "lucide-react";
import { PageHeader }               from "@/components/ui/PageHeader";
import { Badge }                    from "@/components/ui/Badge";
import { Modal, ModalField, ModalInput } from "@/components/ui/Modal";
import { crearMesa, toggleMesa }    from "@/lib/actions/mesas";
import { obtenerMesasConEstado }    from "@/lib/actions/mesas";
import type { MesaConEstado }       from "@/types";
import styles                       from "./mesasAdmin.module.css";

interface Props {
  mesasIniciales: MesaConEstado[];
}

export function MesasAdminClient({ mesasIniciales }: Props) {
  const [mesas,       setMesas]       = useState(mesasIniciales);
  const [modalCrear,  setModalCrear]  = useState(false);
  const [tNombre,     setTNombre]     = useState("");
  const [isPending,   startTransition] = useTransition();

  async function recargar() {
    const actualizadas = await obtenerMesasConEstado();
    setMesas(actualizadas);
  }

  function handleAbrirCrear() {
    setTNombre("");
    setModalCrear(true);
  }

  function handleCrear() {
    const nombre = tNombre.trim();
    if (!nombre) { toast.error("El nombre es requerido"); return; }

    startTransition(async () => {
      const result = await crearMesa(nombre);
      if ("error" in result) { toast.error(result.error); return; }
      toast.success("Mesa creada");
      setModalCrear(false);
      setTNombre("");
      await recargar();
    });
  }

  function handleToggle(mesa: MesaConEstado) {
    if (mesa.ordenAbierta) {
      toast.error("No puedes desactivar una mesa con una orden abierta");
      return;
    }

    startTransition(async () => {
      const result = await toggleMesa(mesa.eCodMesa, !mesa.bStateMesa);
      if ("error" in result) { toast.error(result.error); return; }
      toast.success(`Mesa ${!mesa.bStateMesa ? "activada" : "desactivada"}`);
      await recargar();
    });
  }

  const activas   = mesas.filter((m) =>  m.bStateMesa).length;
  const ocupadas  = mesas.filter((m) => !!m.ordenAbierta).length;

  return (
    <>
      <div className={styles.page}>
        <PageHeader
          titulo="Mesas"
          descripcion={`${activas} activa${activas !== 1 ? "s" : ""} · ${ocupadas} ocupada${ocupadas !== 1 ? "s" : ""}`}
          boton={{ label: "Nueva mesa", onClick: handleAbrirCrear }}
        />

        {mesas.length === 0 ? (
          <div className={styles.vacio}>
            <LayoutGrid size={32} strokeWidth={1.2} />
            <p>No hay mesas configuradas</p>
            <p className={styles.vacioSub}>Crea la primera mesa para comenzar</p>
          </div>
        ) : (
          <div className={styles.lista}>
            {mesas.map((mesa) => {
              const ocupada = !!mesa.ordenAbierta;
              return (
                <div key={mesa.eCodMesa} className={`${styles.mesaRow} ${!mesa.bStateMesa ? styles.mesaInactiva : ""}`}>
                  <div className={styles.mesaInfo}>
                    <span className={styles.mesaNombre}>{mesa.tNombre}</span>
                    <div className={styles.mesaBadges}>
                      <Badge variante={mesa.bStateMesa ? "activo" : "inactivo"} />
                      {mesa.bStateMesa && (
                        <Badge variante={ocupada ? "pendiente" : "disponible"}>
                            {ocupada ? "Ocupada" : "Libre"}
                        </Badge>
                        )}
                    </div>
                  </div>

                  <button
                    className={`${styles.btnToggle} ${mesa.bStateMesa ? styles.btnToggleActiva : styles.btnToggleInactiva}`}
                    onClick={() => handleToggle(mesa)}
                    disabled={isPending || ocupada}
                    title={ocupada ? "Mesa con orden abierta" : mesa.bStateMesa ? "Desactivar" : "Activar"}
                  >
                    <Power size={14} />
                    <span>{mesa.bStateMesa ? "Desactivar" : "Activar"}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal crear mesa */}
      {modalCrear && (
        <Modal
            titulo="Nueva mesa"
            onCerrar={() => setModalCrear(false)}
            onConfirmar={handleCrear}
            labelConfirmar={isPending ? "Creando..." : "Crear mesa"}
            labelCancelar="Cancelar"
            deshabilitado={isPending || !tNombre.trim()}
            cargando={isPending}
        >
            <ModalField label="Nombre de la mesa" required>
            <ModalInput
                value={tNombre}
                onChange={(e) => setTNombre(e.target.value)}
                placeholder="Ej. Mesa 1, Terraza A, Barra..."
                onKeyDown={(e) => e.key === "Enter" && handleCrear()}
                autoFocus
            />
            </ModalField>
        </Modal>
      )}
    </>
  );
}