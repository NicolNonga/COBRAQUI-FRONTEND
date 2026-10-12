"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="pt">
      <body style={{ fontFamily: "system-ui", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 24 }}>Algo correu mal</h1>
          <button onClick={reset} style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, background: "#1580d8", color: "#fff", border: 0 }}>Tentar novamente</button>
        </div>
      </body>
    </html>
  );
}
