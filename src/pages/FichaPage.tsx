import { useParams } from "react-router-dom";

export function FichaPage() {
  const { monitoreoId, fichaId } = useParams();

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold tracking-tight">Formulario</h2>
      <p className="mt-2 text-sm text-white/60">
        Monitoreo: <span className="text-white">{monitoreoId}</span> <br />
        Ficha: <span className="text-white">{fichaId}</span>
      </p>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
        Aquí va el formulario real (encabezado, secciones, preguntas y parte inferior).
      </div>
    </div>
  );
}
