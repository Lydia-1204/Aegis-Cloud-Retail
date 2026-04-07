import { DEFAULT_API_BASES } from "@aegis/shared";

export function App() {
  return (
    <main style={{ padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>门店端</h1>
      <p>门店日常经营、收货与供货协同由此应用承载。</p>
      <pre style={{ background: "#f4f4f5", padding: "1rem", borderRadius: 8 }}>
        {JSON.stringify(DEFAULT_API_BASES, null, 2)}
      </pre>
    </main>
  );
}
