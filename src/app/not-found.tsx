import "./globals.css";

// Shown for addresses outside any language (rare). Kept very simple.
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <h1>Oops! We can&apos;t find that page.</h1>
        <p>
          <a href="/">Go to the home page</a> · <a href="/es">Ir a la página de inicio</a>
        </p>
      </body>
    </html>
  );
}
