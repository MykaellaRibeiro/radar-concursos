import Link from "next/link";
import { requestPasswordReset } from "@/features/auth/actions";

export const metadata = { title: "Recuperar senha" };

export default function ResetPage() {
  return <div className="auth-form-wrap"><h1>Recupere seu acesso.</h1><p>Enviaremos um link seguro se o e-mail estiver cadastrado.</p>
    <form action={requestPasswordReset} className="auth-form"><label className="field">E-mail<input name="email" type="email" autoComplete="email" required /></label><button className="button button--primary" type="submit">Enviar instruções</button></form>
    <div className="auth-links"><Link href="/login">Voltar para o login</Link></div>
  </div>;
}
