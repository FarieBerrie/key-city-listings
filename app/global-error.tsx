"use client";

// Shown only when the root layout itself fails, so it brings its own document and plain styles
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f7f2e9", color: "#2a2622", margin: 0 }}>
        <title>Something went wrong · Key City Listings</title>
        <main style={{ maxWidth: 520, margin: "15vh auto", padding: "0 24px" }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>Something went wrong.</h1>
          <p style={{ marginTop: 12, lineHeight: 1.5 }}>
            Key City Listings hit a problem loading this page. Try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 20,
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              background: "#1f4e5f",
              color: "#fff",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
