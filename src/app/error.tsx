"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("radar_route_error", { digest: error.digest ?? "unavailable" });
  }, [error.digest]);

  return (
    <main className="empty-state" style={{ minHeight: "70vh" }} role="alert">
      <h1>Não foi possível carregar esta página</h1>
      <p>Os dados permanecem preservados. Tente novamente; se a falha continuar, consulte o status do serviço.</p>
      <button className="button button--primary" type="button" onClick={reset}>Tentar novamente</button>
    </main>
  );
}
