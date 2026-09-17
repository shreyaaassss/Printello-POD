import type { ReactNode } from 'react';

import type { PrintArea, PrintSide } from '../../types/catalogue';
import { GarmentOutline, isLight, shapeForSlug } from './GarmentOutline';

interface Props {
  slug: string;
  hex: string;
  side: PrintSide;
  printArea: PrintArea | null;
  /** Rendered inside the print area, clipped to it. Phase 3b puts artwork here. */
  children?: ReactNode;
  className?: string;
}

/**
 * The garment with its printable rectangle marked.
 *
 * Both layers use the same 1000x1200 viewBox and the default
 * `preserveAspectRatio`, so the rectangle lands in the right place at any
 * rendered size without any coordinate maths in the caller. If real outline
 * images replace the built-in shapes, they must be exported at the aspect
 * ratio recorded in `print_areas.image_width/height` or the box will drift.
 */
export function GarmentPreview({ slug, hex, side, printArea, children, className }: Props) {
  // Crimson vanishes on a black tee; lift it to a pale red on dark garments.
  const guide = isLight(hex) ? '#C8102E' : '#FF9AA2';

  return (
    <div className={`relative aspect-[1000/1200] w-full ${className ?? ''}`}>
      <GarmentOutline
        shape={shapeForSlug(slug)}
        hex={hex}
        side={side}
        className="absolute inset-0 h-full w-full"
      />

      {printArea && (
        <svg
          viewBox="0 0 1000 1200"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden
        >
          {children && (
            <>
              <defs>
                <clipPath id={`print-area-${side}`}>
                  <rect
                    x={printArea.x}
                    y={printArea.y}
                    width={printArea.width}
                    height={printArea.height}
                  />
                </clipPath>
              </defs>
              <g clipPath={`url(#print-area-${side})`}>{children}</g>
            </>
          )}

          <rect
            x={printArea.x}
            y={printArea.y}
            width={printArea.width}
            height={printArea.height}
            fill="none"
            stroke={guide}
            strokeWidth={3}
            strokeDasharray="12 8"
          />
        </svg>
      )}
    </div>
  );
}
