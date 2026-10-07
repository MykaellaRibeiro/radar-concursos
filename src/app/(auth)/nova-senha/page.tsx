import { updatePassword } from "@/features/auth/actions";

export const metadata = { title: "Definir nova senha" };

export default async function NewPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <div className="auth-form-wrap"><h1>Defina sua nova senha.</h1><p>Use ao menos 8 caracteres e evite reutilizar uma senha antiga.</p>
    {error && <div className="form-message form-error" role="alert">{error}</div>}
    <form action={updatePassword} className="auth-form">
      <label className="field">Nova senha<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label className="field">Confirmar senha<input name="confirmation" type="password" autoComplete="new-password" minLength={8} required /></label>
      <button className="button button--primary" type="submit">Atualizar senha</button>
    </form>
  </div>;
}
