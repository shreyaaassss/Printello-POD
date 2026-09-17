/** Print method available on a garment. */
export type PrintMethod = 'DTF' | 'DTG';

/** Which face of the garment a print area sits on. */
export type PrintSide = 'front' | 'back';

/** Garment size. Stock is tracked per colour + size on `product_variants`. */
export type SizeCode = 'S' | 'M' | 'L' | 'XL' | '2XL';

/** A garment category — "180 Gsm Regular T-Shirt" and so on. */
export interface Product {
  id: string;
  slug: string;
  name: string;
  gsm: number | null;
  description: string | null;
  basePrice: number;
  printMethods: PrintMethod[];
  sizeChart: SizeChartRow[] | null;
  sortOrder: number;
}

/** One row of the garment measurement table shown in the size accordion. */
export interface SizeChartRow {
  size: SizeCode;
  chestIn: number;
  lengthIn: number;
}

/** A colour offered on a garment, with the flat outline rendered in it. */
export interface ProductColour {
  id: string;
  productId: string;
  name: string;
  hex: string;
  /** Storage path of the flat garment outline, front and back. */
  frontImagePath: string | null;
  backImagePath: string | null;
  sortOrder: number;
}

/** A sellable colour + size combination. */
export interface ProductVariant {
  id: string;
  productId: string;
  colourId: string;
  size: SizeCode;
  priceDelta: number;
  inStock: boolean;
}

/**
 * The printable rectangle on a garment face, in the coordinate space of that
 * face's outline image. Stored in pixels against a known image width so the
 * canvas can scale it to whatever size it renders at.
 */
export interface PrintArea {
  id: string;
  productId: string;
  side: PrintSide;
  /** Natural width/height of the outline image these coordinates refer to. */
  imageWidth: number;
  imageHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Real-world printable size, used for the DPI calculation. */
  widthIn: number;
  heightIn: number;
}
