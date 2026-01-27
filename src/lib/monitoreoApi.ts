import { supabase } from "./supabaseClient";

export type MonitoreoCatalogRow = {
  id: string;
  anio: number;
  codigo: string; // 'LM'
  nombre: string;
  descripcion: string | null;
  is_active: boolean;
};

export type FichaCatalogRow = {
  id: string;
  monitoreo_id: string;
  codigo: string; // 'ESCRIBE' | 'LEE' | 'ORAL'
  titulo: string; // en tu schema es "titulo"
  version: number;
  orden: number;
  is_active: boolean;
};

export type FichaQuestionRow = {
  id: string;
  ficha_id: string;
  qkey: string;   // 'P01'..'P27'
  numero: number; // 1..27
  grupo: string;  // PLANIFICACION/TEXTUALIZACION/REVISION/EVALUACION
  texto: string;
  orden: number;
  is_active: boolean;
};

export async function getMonitoreosByYear(anio: number) {
  const { data, error } = await supabase
    .from("monitoreo_catalog")
    .select("id, anio, codigo, nombre, descripcion, is_active")
    .eq("anio", anio)
    .eq("is_active", true)
    .order("nombre", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as MonitoreoCatalogRow[];
}

export async function getMonitoreoByCodigo(anio: number, codigo: string) {
  const { data, error } = await supabase
    .from("monitoreo_catalog")
    .select("id, anio, codigo, nombre, descripcion, is_active")
    .eq("anio", anio)
    .eq("codigo", codigo)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as MonitoreoCatalogRow | null;
}

export async function getFichasByMonitoreo(monitoreoId: string) {
  const { data, error } = await supabase
    .from("ficha_catalog")
    .select("id, monitoreo_id, codigo, titulo, version, orden, is_active")
    .eq("monitoreo_id", monitoreoId)
    .eq("is_active", true)
    .order("orden", { ascending: true })
    .order("codigo", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as FichaCatalogRow[];
}

export async function getFichaByCodigo(monitoreoId: string, fichaCodigo: string, version = 1) {
  const { data, error } = await supabase
    .from("ficha_catalog")
    .select("id, monitoreo_id, codigo, titulo, version, orden, is_active")
    .eq("monitoreo_id", monitoreoId)
    .eq("codigo", fichaCodigo)
    .eq("version", version)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as FichaCatalogRow | null;
}

export async function getQuestionsByFicha(fichaId: string) {
  const { data, error } = await supabase
    .from("ficha_question")
    .select("id, ficha_id, qkey, numero, grupo, texto, orden, is_active")
    .eq("ficha_id", fichaId)
    .eq("is_active", true)
    .order("orden", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as FichaQuestionRow[];
}
