import Link from "next/link";

export function Logo() {
  return (
    <Link href="/dashboard" className="brand" aria-label="Radar Concursos — início">
      <span className="brand__mark" aria-hidden="true"><span /></span>
      <span className="brand__text">Radar<span>Concursos</span></span>
    </Link>
  );
}
