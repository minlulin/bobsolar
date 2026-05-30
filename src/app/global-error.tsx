"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  useEffect(() => {
    console.error("[Global Error Boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#09090b",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1rem",
        }}
      >
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            marginBottom: "0.5rem",
          }}
        >
          Something went wrong
        </h2>
        <p
          style={{
            color: "#a1a1aa",
            marginBottom: "1.5rem",
            maxWidth: "28rem",
          }}
        >
          A critical error occurred. Please try again.
        </p>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={() => {
              reset();
            }}
            style={{
              backgroundColor: "#fff",
              color: "#000",
              padding: "0.5rem 1.25rem",
              borderRadius: "0.375rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
          <a
            href="/"
            style={{
              backgroundColor: "transparent",
              color: "#a1a1aa",
              padding: "0.5rem 1.25rem",
              borderRadius: "0.375rem",
              fontWeight: 600,
              border: "1px solid #52525b",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            Go to Dashboard
          </a>
        </div>
      </body>
    </html>
  );
}
