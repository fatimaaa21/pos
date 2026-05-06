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