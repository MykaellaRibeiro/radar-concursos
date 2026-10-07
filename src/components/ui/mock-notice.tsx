import { FlaskConical } from "lucide-react";

export function MockNotice() {
  return <div className="mock-notice" role="status"><FlaskConical aria-hidden="true" size={16} /><strong>Dados MOCK</strong><span>Prévia exclusiva do ambiente de desenvolvimento. Não use para decisões reais.</span></div>;
}
