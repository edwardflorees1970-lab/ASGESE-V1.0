import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type Point = { x: number; y: number; t: number };

const EXPORT_WIDTH = 900;
const EXPORT_HEIGHT = 300;
const MIN_DISTANCE = 1.5;
// El PDF imprime esta firma a ~70mm de ancho (factor ~0.078mm/px sobre este
// canvas de 900px). Un trazo de 1.6-4.2px quedaba en ~0.12-0.33mm impreso:
// practicamente invisible. Se sube a un rango que imprime ~0.35-0.7mm.
const MIN_WIDTH = 4.5;
const MAX_WIDTH = 9;
const REF_VELOCITY = 1.1;

function midpoint(a: Point, b: Point) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function strokeWidthFor(a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dt = Math.max(1, b.t - a.t);
  const velocity = Math.hypot(dx, dy) / dt;
  const eased = Math.min(1, velocity / REF_VELOCITY);
  return MAX_WIDTH - eased * (MAX_WIDTH - MIN_WIDTH);
}

export function SignaturePad({
  onChange,
}: {
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const drawingRef = useRef(false);
  const strokesDrawnRef = useRef(0);
  const [hasInk, setHasInk] = useState(false);

  const clearCanvas = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    // ctx is already scaled by devicePixelRatio (see effect below), so all
    // drawing here happens in logical export-space coordinates, not physical pixels.
    ctx.clearRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
    ctx.strokeStyle = "#c7cdd6";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    const guideY = EXPORT_HEIGHT * 0.72;
    ctx.beginPath();
    ctx.moveTo(EXPORT_WIDTH * 0.06, guideY);
    ctx.lineTo(EXPORT_WIDTH * 0.94, guideY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#0f172a";
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = EXPORT_WIDTH * dpr;
    canvas.height = EXPORT_HEIGHT * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    ctxRef.current = ctx;
    clearCanvas();
  }, []);

  const canvasToLocalPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = EXPORT_WIDTH / rect.width;
    const scaleY = EXPORT_HEIGHT / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
      t: event.timeStamp,
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    (event.target as HTMLCanvasElement).setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const point = canvasToLocalPoint(event);
    pointsRef.current = [point];
    setHasInk(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    const point = canvasToLocalPoint(event);
    const pts = pointsRef.current;
    const last = pts[pts.length - 1];
    if (!last) return;
    const dist = Math.hypot(point.x - last.x, point.y - last.y);
    if (dist < MIN_DISTANCE) return;

    pts.push(point);
    if (pts.length < 3) return;

    const prev = pts[pts.length - 3];
    const curr = pts[pts.length - 2];
    const next = point;
    const start = midpoint(prev, curr);
    const end = midpoint(curr, next);

    ctx.lineWidth = strokeWidthFor(curr, next);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(curr.x, curr.y, end.x, end.y);
    ctx.stroke();
    strokesDrawnRef.current += 1;
  };

  const finishStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try {
      (event.target as HTMLCanvasElement).releasePointerCapture(event.pointerId);
    } catch {
      // capture already released, ignore
    }
    pointsRef.current = [];
    const canvas = canvasRef.current;
    if (canvas && strokesDrawnRef.current > 0) {
      onChange(canvas.toDataURL("image/png"));
    } else {
      setHasInk(false);
      onChange(null);
    }
  };

  const handleClear = () => {
    clearCanvas();
    strokesDrawnRef.current = 0;
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <canvas
        ref={canvasRef}
        className="w-full touch-none rounded-lg border border-white/10 bg-white"
        style={{ aspectRatio: `${EXPORT_WIDTH} / ${EXPORT_HEIGHT}` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerLeave={finishStroke}
        onPointerCancel={finishStroke}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-white/45">Firme con el dedo sobre la línea punteada.</p>
        <button
          type="button"
          onClick={handleClear}
          disabled={!hasInk}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 disabled:opacity-40"
        >
          Limpiar
        </button>
      </div>
    </div>
  );
}
