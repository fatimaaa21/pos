"use client";

import { useState, useRef, useEffect } from "react";
import { login } from "@/lib/actions/auth";
import styles from "./page.module.css";
import modal from "@/components/ui/Modal.module.css";

export default function LoginPage() {
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  async function handleLogin(codigo: string) {
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("codigo", codigo);
    const result = await login(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setDigits(["", "", "", ""]);
        inputs.current[0]?.focus();
      }, 600);
    }
  }

  function handleChange(index: number, value: string) {
    // Solo acepta un dígito numérico
    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    // Avanza al siguiente input automáticamente
    if (digit && index < 3) {
      inputs.current[index + 1]?.focus();
    }

    // Si todos están llenos, hace login
    if (digit && index === 3) {
      const codigo = [...newDigits.slice(0, 3), digit].join("");
      if (codigo.length === 4) handleLogin(codigo);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (digits[index]) {
        // Borra el dígito actual
        const newDigits = [...digits];
        newDigits[index] = "";
        setDigits(newDigits);
      } else if (index > 0) {
        // Si ya está vacío, retrocede al anterior
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        setDigits(newDigits);
        inputs.current[index - 1]?.focus();
      }
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < 3) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (pasted.length === 4) {
      setDigits(pasted.split(""));
      inputs.current[3]?.focus();
      handleLogin(pasted);
    }
  }

  return (
    <div className={styles.container}>
      <div className={modal.card}>

        {/* Header */}
        <div style={{ textAlign: "center" }}>
          <div className={styles.logo}>🥐</div>
          <h1 className={modal.title}>Bienvenido</h1>
          <p className={styles.subtitulo}>
            Ingresa tu código de acceso
          </p>
        </div>

        {/* PIN inputs */}
        <div className={`${styles.inputs} ${shake ? styles.shake : ""}`}
          onPaste={handlePaste}
        >
          {digits.map((digit, i) => {
            const isFilled = !!digit;
            const isFocused = focusedIndex === i;
            let inputClass = styles.pinInput;
            if (isFilled) inputClass += ` ${styles.pinInputFilled}`;
            else if (isFocused) inputClass += ` ${styles.pinInputFocused}`;
            else inputClass += ` ${styles.pinInputDefault}`;

            return (
              <input
                key={i}
                ref={(el) => { inputs.current[i] = el; }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                disabled={loading}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={() => setFocusedIndex(i)}
                onBlur={() => setFocusedIndex(null)}
                className={inputClass}
              />
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className={styles.error}>
            ⚠️ {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <p className={styles.loading}>
            Verificando...
          </p>
        )}
      </div>
    </div>
  );
}