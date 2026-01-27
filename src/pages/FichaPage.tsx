import { Navigate, useParams } from "react-router-dom";
import { FichaEscribeLMPage } from "./FichaEscribeLMPage";
import { FICHA_ESCRIBE_LM } from "../forms/ficha_escribe_lm";

export function FichaPage() {
  const { monitoreoId, fichaId } = useParams();

  // Si por alguna razón no vienen params, regresa a elegir monitoreo
  if (!monitoreoId || !fichaId) {
    return <Navigate to="/app/monitoreo" replace />;
  }

  // Router de fichas (aquí irás agregando más)
  if (fichaId === FICHA_ESCRIBE_LM.key) {
    return <FichaEscribeLMPage />;
  }

  // Ficha desconocida: no castigues con login; vuelve a monitoreo
  return <Navigate to="/app/monitoreo" replace />;
}
