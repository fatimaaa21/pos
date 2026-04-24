"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Categoria } from "@/types";

export function useCategorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("categorias")
      .select("*")
      .order("tNameCategory");

    if (error) {
      setError("No se pudieron cargar las categorías");
    } else {
      setCategorias(data as Categoria[]);
    }
    setLoading(false);
  }

  async function crear(tNameCategory: string, ImgCategory: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("categorias")
      .insert({
        tNameCategory,
        ImgCategory,
        bStateCategory: true,
        fhCreateCategory: new Date().toISOString(),
      });

    if (!error) await cargar();
    return { error };
  }

  async function actualizar(eCodCategory: number, tNameCategory: string, ImgCategory: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("categorias")
      .update({
        tNameCategory,
        ImgCategory,
        fhUpdateCategory: new Date().toISOString(),
      })
      .eq("eCodCategory", eCodCategory);

    if (!error) await cargar();
    return { error };
  }

  async function toggleEstado(eCodCategory: number, estadoActual: boolean) {
    const supabase = createClient();
    const { error } = await supabase
      .from("categorias")
      .update({
        bStateCategory: !estadoActual,
        fhUpdateCategory: new Date().toISOString(),
      })
      .eq("eCodCategory", eCodCategory);

    if (!error) await cargar();
    return { error };
  }

  async function eliminar(eCodCategory: number) {
    const supabase = createClient();
    const { error } = await supabase
      .from("categorias")
      .delete()
      .eq("eCodCategory", eCodCategory);

    if (!error) await cargar();
    return { error };
  }

  useEffect(() => { cargar(); }, []);

  return { categorias, loading, error, crear, actualizar, eliminar, toggleEstado };
}