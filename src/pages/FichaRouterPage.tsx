import { useParams } from "react-router-dom";
import { FichaEscribeLMPage } from "./FichaEscribeLMPage";

function Placeholder({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-white/60">Módulo en construcción.</p>
    </div>
  );
}

export function FichaRouterPage() {
  const { monitoreoCodigo, fichaCodigo } = useParams();

  const m = (monitoreoCodigo || "").toUpperCase();
  const f = (fichaCodigo || "").toUpperCase();

  // Por ahora implementamos LM/ESCRIBE real
  if (m === "LM" && f === "ESCRIBE") {
    return <FichaEscribeLMPage />;
  }

  if (m === "LM" && f === "LEE") {
    return <Placeholder title="LM - Ficha LEE (pendiente)" />;
  }

  if (m === "LM" && f === "ORAL") {
    return <Placeholder title="LM - Ficha ORAL (pendiente)" />;
  }

  return <Placeholder title={`Ficha no soportada: ${m}/${f}`} />;
}
