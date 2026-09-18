import { useRef, useState } from 'react';

import type { PrintArea, PrintSide } from '../../types/catalogue';
import { GarmentPreview } from '../garment/GarmentPreview';
import {
  type Corner,
  type Placement,
  clampPlacement,
  placementRect,
  resizeFromCorner,
} from './placement';

interface Props {
  slug: string;
  hex: string;
  side: PrintSide;
  printArea: PrintArea | null;
  /** Public URL of the garment outline image, when one has been uploaded. */
  outlineUrl?: string | null;
  /** Signed URL of the chosen design, or null when none is placed yet. */
  artworkUrl: string | null;
  /** Design width / height. Drives every fit and clamp decision. */
  aspect: number;
  placement: Placement;
  onPlacementChange: (next: Placement) => void;
  className?: string;
}

type Drag =
  | { mode: 'move'; from: Placement; startX: number; startY: number }
  | { mode: 'resize'; corner: Corner };

const CORNERS: Array<{ corner: Corner; cursor: string; at: [number, number] }> = [
  { corner: 'nw', cursor: 'nwse-resize', at: [0, 0] },
  { corner: 'ne', cursor: 'nesw-resize', at: [1, 0] },
  { corner: 'sw', cursor: 'nesw-resize', at: [0, 1] },
  { corner: 'se', cursor: 'nwse-resize', at: [1, 1] },
];

/**
 * The garment with the design on it: drag to move, drag a corner to resize.
 *
 * Pointer positions are converted into print-area fractions and then clamped,
 * so the design can never leave the printable region — containment is a
 * property of the interaction, not something validated afterwards.
 */
export function ArtworkStage({
  slug,
  hex,
  side,
  printArea,
  outlineUrl,
  artworkUrl,
  aspect,
  placement,
  onPlacementChange,
  className,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [active, setActive] = useState(false);

  const placed = Boolean(artworkUrl && printArea);
  const rect = printArea && artworkUrl ? placementRect(printArea, aspect, placement) : null;

  /** Pointer position as a fraction of the print area. */
  function toAreaFraction(clientX: number, clientY: number) {
    const host = hostRef.current;
    if (!host || !printArea) return null;
    const box = host.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return null;
    // The SVG fills the host exactly, because the host is locked to the same
    // 1000x1200 aspect ratio.
    const vx = ((clientX - box.left) / box.width) * 1000;
    const vy = ((clientY - box.top) / box.height) * 1200;
    return {
      x: (vx - printArea.x) / printArea.width,
      y: (vy - printArea.y) / printArea.height,
    };
  }

  function startMove(e: React.PointerEvent) {
    if (!placed) return;
    dragRef.current = { mode: 'move', from: placement, startX: e.clientX, startY: e.clientY };
    setActive(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function startResize(e: React.PointerEvent, corner: Corner) {
    if (!placed) return;
    e.stopPropagation();
    dragRef.current = { mode: 'resize', corner };
    setActive(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || !printArea) return;

    if (drag.mode === 'move') {
      const host = hostRef.current;
      if (!host) return;
      const box = host.getBoundingClientRect();
      if (box.width === 0) return;
      const unitsPerPx = 1000 / box.width;
      const dx = ((e.clientX - drag.startX) * unitsPerPx) / printArea.width;
      const dy = ((e.clientY - drag.startY) * unitsPerPx) / printArea.height;
      onPlacementChange(
        clampPlacement(printArea, aspect, {
          ...drag.from,
          x: drag.from.x + dx,
          y: drag.from.y + dy,
        }),
      );
      return;
    }

    const point = toAreaFraction(e.clientX, e.clientY);
    if (!point) return;
    onPlacementChange(
      resizeFromCorner(printArea, aspect, placement, drag.corner, point.x, point.y),
    );
  }

  function endDrag(e: React.PointerEvent) {
    if (!dragRef.current) return;
    dragRef.current = null;
    setActive(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  // Percentages of the host, so the overlay tracks the SVG at any size.
  const box = rect
    ? {
        left: `${(rect.x / 1000) * 100}%`,
        top: `${(rect.y / 1200) * 100}%`,
        width: `${(rect.width / 1000) * 100}%`,
        height: `${(rect.height / 1200) * 100}%`,
      }
    : null;

  return (
    <div
      ref={hostRef}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`relative select-none ${className ?? ''}`}
      style={{ touchAction: placed ? 'none' : undefined }}
    >
      <GarmentPreview
        slug={slug}
        hex={hex}
        side={side}
        printArea={printArea}
        outlineUrl={outlineUrl}
      >
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

      {/* Transform box. HTML rather than SVG so the handles stay a constant
          size on screen regardless of how large the garment renders. */}
      {box && (
        <div
          onPointerDown={startMove}
          style={box}
          className={`absolute border border-blue-500 ${active ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          {CORNERS.map(({ corner, cursor, at: [cx, cy] }) => (
            <div
              key={corner}
              onPointerDown={(e) => startResize(e, corner)}
              style={{
                cursor,
                left: `${cx * 100}%`,
                top: `${cy * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute h-3 w-3 rounded-[2px] border border-blue-600 bg-white shadow-sm"
              aria-label={`Resize from ${corner}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
