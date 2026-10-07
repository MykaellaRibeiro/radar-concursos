import Link from "next/link";
import { ExternalLink, FileText } from "lucide-react";

export function DocumentActions({ storageUrl, sourceUrl, title }: { storageUrl: string | null; sourceUrl: string | null; title: string }) {
  return <div className="document-actions">
    {storageUrl && <Link className="button button--subtle button--compact" href={storageUrl} target="_blank" rel="noopener noreferrer" aria-label={`Abrir PDF armazenado: ${title}`}><FileText size={14} /> Abrir PDF</Link>}
    {sourceUrl && <Link className="document-source-link" href={sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`Ver fonte original: ${title}`}>Ver fonte <ExternalLink size={12} /></Link>}
  </div>;
}
