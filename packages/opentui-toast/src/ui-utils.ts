/**
 * Padding style properties with shorthand support
 *
 * Supports CSS-like padding specification:
 * - `padding`: Uniform padding for all sides
 * - `paddingX`: Horizontal padding (left and right)
 * - `paddingY`: Vertical padding (top and bottom)
 * - `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`: Individual sides
 *
 * Priority should be highest to lowest:
 * 1. Specific side (paddingTop, paddingRight, etc.)
 * 2. Axis (paddingX, paddingY)
 * 3. Uniform (padding)
 */
export interface PaddingInput {
  /** Uniform padding for all sides */
  padding?: number;
  /** Horizontal padding (left and right) */
  paddingX?: number;
  /** Vertical padding (top and bottom) */
  paddingY?: number;
  /** Top padding */
  paddingTop?: number;
  /** Right padding */
  paddingRight?: number;
  /** Bottom padding */
  paddingBottom?: number;
  /** Left padding */
  paddingLeft?: number;
}

/**
 * Padding values for all four sides
 */
export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Merge multiple style objects (later wins)
 *
 * Uses shallow Object.assign, so later styles completely
 * override earlier values for the same property.
 *
 * @param styles - Style objects to merge (undefined values are skipped)
 * @returns Merged style object
 *
 * @example
 * ```ts
 * mergeStyles(
 *   { borderColor: "red", padding: 1 },
 *   { borderColor: "blue" }
 * )
 * // => { borderColor: "blue", padding: 1 }
 *
 * mergeStyles(
 *   { padding: 1 },
 *   undefined,
 *   { paddingLeft: 2 }
 * )
 * // => { padding: 1, paddingLeft: 2 }
 * ```
 */
export function mergeStyles<T extends object>(
  ...styles: (Partial<T> | undefined)[]
): T {
  const result = {} as T;

  for (const style of styles) {
    if (!style) continue;
    Object.assign(result, style);
  }

  return result;
}

/**
 * Resolve padding values with shorthand support
 *
 * Priority (highest to lowest):
 * 1. Specific side (paddingTop, paddingRight, etc.)
 * 2. Axis (paddingX, paddingY)
 * 3. Uniform (padding)
 * 4. Default values
 *
 * @param style - Style object containing padding properties
 * @param defaults - Default padding values (defaults to 0 for all sides)
 * @returns Resolved padding for each side
 *
 * @example
 * ```ts
 * resolvePadding({ padding: 1 })
 * // => { top: 1, right: 1, bottom: 1, left: 1 }
 *
 * resolvePadding({ paddingX: 2, paddingY: 1 })
 * // => { top: 1, right: 2, bottom: 1, left: 2 }
 *
 * resolvePadding({ padding: 1, paddingLeft: 3 })
 * // => { top: 1, right: 1, bottom: 1, left: 3 }
 *
 * resolvePadding({ paddingTop: 2 }, { top: 0, right: 1, bottom: 0, left: 1 })
 * // => { top: 2, right: 1, bottom: 0, left: 1 }
 * ```
 */
export function resolvePadding(
  style?: PaddingInput,
  defaults: Padding = { top: 0, right: 0, bottom: 0, left: 0 }
): Padding {
  if (!style) {
    return { ...defaults };
  }

  const uniform = style.padding;
  const axisX = style.paddingX;
  const axisY = style.paddingY;

  return {
    top: style.paddingTop ?? axisY ?? uniform ?? defaults.top,
    right: style.paddingRight ?? axisX ?? uniform ?? defaults.right,
    bottom: style.paddingBottom ?? axisY ?? uniform ?? defaults.bottom,
    left: style.paddingLeft ?? axisX ?? uniform ?? defaults.left,
  };
}
