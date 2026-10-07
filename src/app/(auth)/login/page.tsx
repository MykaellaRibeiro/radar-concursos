import Link from "next/link";
import { signIn } from "@/features/auth/actions";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const params = await searchParams;
  return <div className="auth-form-wrap"><h1>Bem-vindo de volta.</h1><p>Entre para ver o que mudou nos concursos que você acompanha.</p>
    {params.message && <div className="form-message" role="status">{params.message}</div>}
    {params.error && <div className="form-message form-error" role="alert">{params.error}</div>}
    <form action={signIn} className="auth-form">
      <input type="hidden" name="next" value={params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/dashboard"} />
      <label className="field">E-mail<input name="email" type="email" autoComplete="email" required /></label>
      <label className="field">Senha<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
      <button className="button button--primary" type="submit">Entrar</button>
    </form>
    <div className="auth-links"><Link href="/cadastro">Criar uma conta</Link><Link href="/recuperar-senha">Esqueci minha senha</Link></div>
  </div>;
}
