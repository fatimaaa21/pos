import { createClient } from "./client";

export async function subirAvatar(file: File, eCodUser: string) {
  const supabase = createClient();

  if (file.size > 2 * 1024 * 1024) {
    return { url: null, error: "La imagen debe pesar menos de 2MB" };
  }

  const ext = file.name.split(".").pop();
  const path = `${eCodUser}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true });

  if (uploadError) return { url: null, error: uploadError.message };

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);

  return { url: data.publicUrl, error: null };
}

/**
 * Sube una imagen al bucket "category-images".
 *
 * - Siempre usa el path  categorias/{eCodCategory}  (sin extensión)
 *   para que la misma fila de la DB siempre apunte al mismo archivo.
 * - Devuelve { url, urlConCache } :
 *     url          → URL limpia para guardar en la DB
 *     urlConCache  → URL con ?t=... para forzar recarga en el browser
 */
export async function subirImagen(file: File, bucket: string, path: string) {
  const supabase = createClient();
 
  if (file.size > 2 * 1024 * 1024) {
    return { url: null, urlConCache: null, error: "La imagen debe pesar menos de 2MB" };
  }
 
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: file.type });
 
  if (uploadError) {
    return { url: null, urlConCache: null, error: uploadError.message };
  }
 
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
 
  const url = data.publicUrl;
  const urlConCache = `${url}?t=${Date.now()}`;
 
  return { url, urlConCache, error: null };
}