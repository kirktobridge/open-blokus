import { useMemo } from 'react';
import type { Color } from '../../game/types';
import { BOARD_SIZE } from '../../shared/constants';
import { CELL_PX } from '../theme';
import { usePaletteColors } from '../palettes';
import { PlacedLayer } from '../board/PlacedLayer';

/**
 * A fixed, developed mid-game position rendered read-only as the home-screen
 * hero. Generated once from the pure rules core (heuristic self-play, seed 7,
 * 28 plies) and embedded as a static cell list — so it carries no engine into
 * the initial bundle and stays deterministic. Cells are packed as
 * `[boardIndex, colorInitial]`; index = y * BOARD_SIZE + x.
 */
const HERO_CELLS: [number, string][] = [
  [0, 'b'], [18, 'y'], [19, 'y'], [20, 'b'], [21, 'b'], [37, 'y'], [38, 'y'],
  [41, 'b'], [42, 'b'], [44, 'b'], [49, 'b'], [50, 'b'], [57, 'y'], [63, 'b'],
  [64, 'b'], [65, 'b'], [68, 'b'], [69, 'b'], [70, 'b'], [71, 'y'], [76, 'y'],
  [84, 'b'], [86, 'b'], [87, 'b'], [90, 'y'], [91, 'y'], [92, 'y'], [93, 'y'],
  [95, 'y'], [96, 'y'], [97, 'y'], [107, 'b'], [108, 'b'], [111, 'b'], [114, 'y'],
  [116, 'y'], [127, 'b'], [129, 'b'], [130, 'b'], [131, 'b'], [132, 'y'], [133, 'y'],
  [134, 'y'], [146, 'b'], [149, 'y'], [150, 'y'], [151, 'b'], [153, 'y'], [155, 'y'],
  [156, 'y'], [166, 'b'], [167, 'b'], [170, 'y'], [171, 'y'], [172, 'y'], [173, 'r'],
  [174, 'r'], [175, 'y'], [177, 'y'], [185, 'b'], [187, 'b'], [188, 'g'], [191, 'r'],
  [192, 'r'], [193, 'r'], [194, 'y'], [195, 'y'], [197, 'y'], [203, 'b'], [204, 'b'],
  [205, 'b'], [207, 'b'], [208, 'g'], [209, 'r'], [210, 'r'], [211, 'g'], [212, 'g'],
  [214, 'r'], [215, 'r'], [216, 'r'], [217, 'y'], [223, 'b'], [225, 'g'], [227, 'g'],
  [228, 'g'], [230, 'r'], [232, 'g'], [235, 'r'], [237, 'y'], [238, 'y'], [245, 'g'],
  [246, 'g'], [248, 'g'], [250, 'r'], [251, 'r'], [252, 'g'], [253, 'g'], [255, 'r'],
  [264, 'g'], [265, 'g'], [269, 'g'], [270, 'g'], [271, 'g'], [272, 'r'], [283, 'g'],
  [288, 'g'], [290, 'g'], [291, 'r'], [292, 'r'], [293, 'r'], [302, 'g'], [303, 'g'],
  [304, 'g'], [308, 'g'], [310, 'g'], [313, 'r'], [315, 'r'], [323, 'g'], [327, 'g'],
  [328, 'g'], [329, 'r'], [330, 'r'], [331, 'r'], [332, 'r'], [334, 'r'], [335, 'r'],
  [336, 'r'], [342, 'g'], [347, 'g'], [350, 'r'], [355, 'r'], [357, 'r'], [358, 'r'],
  [361, 'g'], [362, 'g'], [378, 'r'], [379, 'r'], [380, 'g'], [381, 'g'], [399, 'r'],
];

const INITIAL_TO_COLOR: Record<string, Color> = {
  b: 'blue',
  y: 'yellow',
  r: 'red',
  g: 'green',
};

const FULL_PX = BOARD_SIZE * CELL_PX;

/**
 * Decorative, non-interactive board. Renders the mat + grid backdrop and the
 * real placed-piece finish (PlacedLayer) at full size, then CSS-scales the whole
 * thing down to `size` px so it inherits the exact gel look, the viewer's custom
 * palette, and the active theme with zero extra styling.
 */
export function HeroBoard({ size = 260 }: { size?: number }) {
  const colors = usePaletteColors();
  const board = useMemo(() => {
    const b: (Color | null)[] = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => null);
    for (const [i, ch] of HERO_CELLS) b[i] = INITIAL_TO_COLOR[ch];
    return b;
  }, []);
  const scale = size / FULL_PX;

  return (
    <div
      aria-hidden="true"
      data-testid="hero-board"
      style={{ width: size, height: size, flex: '0 0 auto' }}
    >
      <div
        style={{
          position: 'relative',
          width: FULL_PX,
          height: FULL_PX,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          background: 'var(--mat)',
          backgroundImage: `repeating-linear-gradient(0deg, var(--grid) 0 1px, transparent 1px ${CELL_PX}px), repeating-linear-gradient(90deg, var(--grid) 0 1px, transparent 1px ${CELL_PX}px)`,
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: 'inset 0 0 0 1px var(--pnl-bd)',
        }}
      >
        <PlacedLayer board={board} colors={colors} />
      </div>
    </div>
  );
}
