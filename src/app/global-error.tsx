"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body>
        <main className="empty-state" style={{ minHeight: "100vh" }} role="alert">
          <h1>O Radar encontrou uma falha inesperada</h1>
          <p>Nenhum dado foi descartado. Recarregue a aplicação para restabelecer a conexão.</p>
          <button className="button button--primary" type="button" onClick={reset}>Recarregar aplicação</button>
        </main>
      </body>
    </html>
  );
}
