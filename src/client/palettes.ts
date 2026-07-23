import type { Color } from '../game/types';
import { ALL_COLORS } from '../shared/constants';
import { PIECE_TOKEN } from './theme';

/**
 * A preset piece-color palette (P60): a complete assignment of every semantic
 * color — Classic's blue/yellow/red/green and Duo's black/white — to a hex. It
 * is *only* piece colors; applying one overlays the six `--piece-*` tokens onto
 * the active theme (appearance.applyPiecePalette), riding on top of whatever mat
 * is selected. `Record<Color, string>` makes a missing color a type error, so
 * the registry can't ship a palette that leaves a piece uncolored.
 */
export interface PiecePalette {
  id: string;
  name: string;
  colors: Record<Color, string>;
}

/**
 * The presets. A colorblind-safe set (Okabe–Ito, the one with a near-objective
 * bar) leads; the rest are IDE-theme *inspired* — nudged off the source pastels
 * where a pale hue would wash out on a cream mat (Linen/Walnut), since the bar
 * is "legible on all three built-in mats", not "byte-faithful to the IDE theme".
 * black/white are each a themed near-black / near-white pair for Duo; the P59
 * value-class finish keeps them legible on same-value mats.
 */
export const PIECE_PALETTES: readonly PiecePalette[] = [
  {
    id: 'okabe-ito',
    name: 'Colorblind-safe',
    colors: {
      blue: '#0072b2',
      yellow: '#efb700',
      red: '#d55e00',
      green: '#009e73',
      black: '#14181f',
      white: '#f4f4f5',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    colors: {
      blue: '#7b8cf0',
      yellow: '#d9bf3b',
      red: '#ff5555',
      green: '#31c46a',
      black: '#282a36',
      white: '#f8f8f2',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    colors: {
      blue: '#7aa2f7',
      yellow: '#e0af68',
      red: '#f7768e',
      green: '#9ece6a',
      black: '#1a1b26',
      white: '#c0caf5',
    },
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin',
    colors: {
      blue: '#89b4fa',
      yellow: '#e5c07b',
      red: '#f38ba8',
      green: '#8bd88a',
      black: '#1e1e2e',
      white: '#cdd6f4',
    },
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox',
    colors: {
      blue: '#83a598',
      yellow: '#d79921',
      red: '#cc241d',
      green: '#98971a',
      black: '#282828',
      white: '#ebdbb2',
    },
  },
];

/** A palette's six colors as `--piece-*` token overrides, ready for the store. */
export function pieceOverridesOf(palette: PiecePalette): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of ALL_COLORS) out[PIECE_TOKEN[c]] = palette.colors[c];
  return out;
}
