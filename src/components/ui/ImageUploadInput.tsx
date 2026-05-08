"use client";

import { useRef, useState, useCallback } from "react";
import { subirImagen } from "@/lib/supabase/storage";
import styles from "./ImageUploadInput.module.css";

interface ImageUploadInputProps {
  value?: string;
  onChange: (url: string) => void;
  placeholder?: string;
  /** Bucket de Supabase Storage donde se sube el archivo */
  bucket: string;
  /** Path dentro del bucket. Ej: "categorias/uuid" o "productos/uuid" */
  storagePath: string;
}

function conCacheBuster(url: string): string {
  if (!url) return url;
  return `${url.split("?")[0]}?t=${Date.now()}`;
}

export function ImageUploadInput({
  value,
  onChange,
  placeholder = "Subir imagen",
  bucket,
  storagePath,
}: ImageUploadInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(
    value ? conCacheBuster(value) : null
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadError("Solo se permiten imágenes");
      return;
    }

    const blobUrl = URL.createObjectURL(file);
    setPreview(blobUrl);
    setUploadError(null);
    setUploading(true);

    const { url, urlConCache, error } = await subirImagen(file, bucket, storagePath);

    setUploading(false);
    URL.revokeObjectURL(blobUrl);

    if (error || !url || !urlConCache) {
      setPreview(null);
      setUploadError(error ?? "Error al subir imagen");
      onChange("");
      return;
    }

    setPreview(urlConCache);
    onChange(url);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [bucket, storagePath],
  );

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    setPreview(null);
    setUploadError(null);
    onChange("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={styles.wrapper}>
      <div
        className={[
          styles.dropzone,
          dragging ? styles.dragging : "",
          preview ? styles.hasPreview : "",
          uploading ? styles.uploading : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className={styles.hiddenInput}
          onChange={handleChange}
          disabled={uploading}
        />

        {preview ? (
          <div className={styles.previewWrap}>
            <img src={preview} alt="Preview" className={styles.previewImg} />

            {uploading && (
              <div className={styles.uploadingOverlay}>
                <Spinner />
                <span>Subiendo...</span>
              </div>
            )}

            {!uploading && (
              <>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={handleRemove}
                  title="Eliminar imagen"
                >
                  ×
                </button>
                <div className={styles.previewOverlay}>
                  <CameraIcon />
                  <span>Cambiar imagen</span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.iconWrap}>
              {uploading ? <Spinner /> : <CameraIcon />}
            </div>
            <div className={styles.textWrap}>
              <span className={styles.textPrimary}>
                {uploading ? "Subiendo imagen..." : placeholder}
              </span>
              {!uploading && (
                <span className={styles.textSecondary}>PNG, JPG hasta 2MB</span>
              )}
            </div>
          </div>
        )}
      </div>

      {uploadError && <p className={styles.errorText}>⚠ {uploadError}</p>}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      style={{ animation: "spin 0.8s linear infinite" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}