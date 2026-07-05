'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Aláírás-rögzítő komponens munkalap sign-off-hoz.
 *
 * - <canvas> alapú, egér és touch eseményekkel (mobil-ready).
 * - Tollszín: fekete (#000), vonalvastagság: 2px, háttér: fehér.
 * - "Tisztítás" gomb a vászon visszaállítására.
 * - Aláíró neve kötelező mező.
 * - Mentéskor a vászon tartalmát base64 PNG-ként adja vissza onSign-en keresztül.
 *
 * A komponens self-contained — a hívó (Work-Order detail oldal) felel a backend
 * felé küldött payload-ért és a SWR revalidate*Scope hívásokért.
 */

const CANVAS_W = 600;
const CANVAS_H = 200;
const PEN_COLOR = '#000000';
const PEN_WIDTH = 2;

interface SignaturePadProps {
  onSign: (base64Png: string, signerName: string) => void;
  onCancel: () => void;
  initialName?: string;
}

export function SignaturePad({ onSign, onCancel, initialName = '' }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const dirtyRef = useRef(false);

  const [signerName, setSignerName] = useState(initialName);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const resetCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Fehér háttér — fontos, hogy PNG-be is mentsük (különben átlátszó lenne).
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = PEN_COLOR;
    ctx.lineWidth = PEN_WIDTH;
    dirtyRef.current = false;
    setHasDrawn(false);
  }, []);

  useEffect(() => {
    resetCanvas();
  }, [resetCanvas]);

  // Pointer-koordinátát canvas-koordinátára konvertálunk — figyelembe véve a
  // CSS-skálázódást (a canvas belső felbontása fix, a CSS-mérete responsive).
  function getPoint(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX: number;
    let clientY: number;
    if ('touches' in e) {
      const touch = e.touches[0] ?? e.changedTouches[0];
      if (!touch) return null;
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    if ('touches' in e) e.preventDefault(); // touch — letiltjuk a görgetést rajzolás alatt
    const point = getPoint(e);
    if (!point) return;
    drawingRef.current = true;
    lastPointRef.current = point;
  }

  function moveDraw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawingRef.current) return;
    if ('touches' in e) e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const point = getPoint(e);
    const last = lastPointRef.current;
    if (!point || !last) return;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setHasDrawn(true);
    }
  }

  function endDraw() {
    drawingRef.current = false;
    lastPointRef.current = null;
  }

  function handleSubmit() {
    const name = signerName.trim();
    if (!name) return;
    if (!hasDrawn) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSubmitting(true);
    try {
      const base64 = canvas.toDataURL('image/png');
      onSign(base64, name);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = signerName.trim().length > 0 && hasDrawn && !submitting;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Aláíró neve <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          maxLength={200}
          placeholder="pl. Kovács János"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-gray-600">
            Aláírás <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={resetCanvas}
            className="text-xs font-medium text-gray-600 hover:text-gray-900 underline"
          >
            Tisztítás
          </button>
        </div>
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="block w-full touch-none cursor-crosshair"
            style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
            onMouseDown={startDraw}
            onMouseMove={moveDraw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={moveDraw}
            onTouchEnd={endDraw}
          />
        </div>
        {!hasDrawn && (
          <p className="text-[11px] text-gray-400 mt-1">
            Húzza végig az ujját vagy az egeret a vásznon az aláíráshoz.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          Mégsem
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Mentés…' : 'Aláírás mentése'}
        </button>
      </div>
    </div>
  );
}

export default SignaturePad;
