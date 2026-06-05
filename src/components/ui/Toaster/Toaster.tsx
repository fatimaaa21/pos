"use client";

import { Toaster } from "react-hot-toast";

export function ToasterKivi() {
  return (
    <Toaster
      position="top-center"
      gutter={8}
      toastOptions={{
        duration: 3500,
        style: {
          fontFamily: "var(--font-family)",
          fontSize: "13px",
          fontWeight: 600,
          borderRadius: "var(--radius-lg, 12px)",
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.08), 0 10px 24px -4px rgba(0,0,0,0.08)",
          padding: "10px 14px",
          maxWidth: "420px",
        },
        success: {
          style: {
            background: "white",
            color: "var(--color-primary-dark, #4a6219)",
            border: "1.5px solid var(--color-primary-light, #D0D9C0)",
          },
          iconTheme: {
            primary: "var(--color-primary, #628321)",
            secondary: "white",
          },
        },
        error: {
          style: {
            background: "white",
            color: "var(--color-error, #dc2626)",
            border: "1.5px solid var(--color-error-border, #fecaca)",
          },
          iconTheme: {
            primary: "var(--color-error, #dc2626)",
            secondary: "white",
          },
          duration: 5000,
        },
      }}
    />
  );
}