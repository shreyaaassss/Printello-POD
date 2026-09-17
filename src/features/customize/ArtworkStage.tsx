import { useRef, useState } from 'react';

import type { PrintArea, PrintSide } from '../../types/catalogue';
import { GarmentPreview } from '../garment/GarmentPreview';
import { clampPlacement, placementRect, type Placement } from './placement';

interface Props {
  slug: string;
  hex: string;
  side: PrintSide;
  printArea: PrintArea | null;
  /** Signed URL of the chosen design, or null when none is placed yet. */
  artworkUrl: string | null;
  /** Design width / height. Drives every fit and clamp decision. */
  aspect: number;
  placement: Placement;
  onPlacementChange: (next: Placement) => void;
  className?: string;
}

/**
 * The garment preview with the design on it, draggable inside the print area.
 *
 * Pointer deltas are converted to print-area fractions and then clamped, so
 * the design can never be dragged outside the printable region — containment
 * is a property of the interaction rather than something validated later.
 */
export function ArtworkStage({
  slug,
  hex,
  side,
  printArea,
  artworkUrl,
  aspect,
  placement,
  onPlacementChange,
  className,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; from: Placement } | null>(null);
  const [dragging, setDragging] = useState(false);

  const canDrag = Boolean(artworkUrl && printArea);

  function onPointerDown(e: React.PointerEvent) {
    if (!canDrag) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, from: placement };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const host = hostRef.current;
    if (!drag || !host || !printArea) return;

    const rect = host.getBoundingClientRect();
    if (rect.width === 0) return;

    // The SVG uses a 1000-wide viewBox and fills the host exactly, because the
    // host is locked to the same aspect ratio.
    const unitsPerPx = 1000 / rect.width;
    const dxUnits = (e.clientX - drag.startX) * unitsPerPx;
    const dyUnits = (e.clientY - drag.startY) * unitsPerPx;

    onPlacementChange(
      clampPlacement(printArea, aspect, {
        ...drag.from,
        x: drag.from.x + dxUnits / printArea.width,
        y: drag.from.y + dyUnits / printArea.height,
      }),
    );
  }

  function endDrag(e: React.PointerEvent) {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  const rect =
    printArea && artworkUrl ? placementRect(printArea, aspect, placement) : null;

  return (
    <div
      ref={hostRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`relative select-none ${canDrag ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''} ${className ?? ''}`}
      // The browser's own pan gesture would otherwise win on touch devices.
      style={{ touchAction: canDrag ? 'none' : undefined }}
    >
      <GarmentPreview slug={slug} hex={hex} side={side} printArea={printArea}>
        {rect && artworkUrl && (
          <image
            href={artworkUrl}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            preserveAspectRatio="xMidYMid meet"
          />
        )}
      </GarmentPreview>
    </div>
  );
}
