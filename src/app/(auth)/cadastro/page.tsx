import Link from "next/link";
import { signUp } from "@/features/auth/actions";

export const metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return <div className="auth-form-wrap"><h1>Comece seu radar.</h1><p>Crie sua conta para acompanhar concursos e receber alertas internos.</p>
    <form action={signUp} className="auth-form">
      <label className="field">Nome<input name="nome" autoComplete="name" minLength={2} required /></label>
      <label className="field">E-mail<input name="email" type="email" autoComplete="email" required /></label>
      <label className="field">Senha<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      <button className="button button--primary" type="submit">Criar conta</button>
    </form>
    <div className="auth-links"><Link href="/login">Já tenho uma conta</Link></div>
  </div>;
}
