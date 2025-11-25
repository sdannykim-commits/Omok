import { BOARD_SIZE, WIN_LENGTH, DIRECTIONS } from '../constants';
import { Player } from '../types';

/**
 * converts 2D coordinates to 1D index
 */
export const getIndex = (row: number, col: number): number => {
  return row * BOARD_SIZE + col;
};

/**
 * converts 1D index to 2D coordinates
 */
export const getCoords = (index: number): { row: number; col: number } => {
  return {
    row: Math.floor(index / BOARD_SIZE),
    col: index % BOARD_SIZE,
  };
};

/**
 * Checks if the last move resulted in a win.
 * Returns the winning line indices if won, otherwise null.
 */
export const checkWin = (board: Player[], lastMoveIndex: number, player: Player): number[] | null => {
  if (lastMoveIndex < 0) return null;

  const { row: lastRow, col: lastCol } = getCoords(lastMoveIndex);

  for (const [dRow, dCol] of DIRECTIONS) {
    let count = 1;
    const lineIndices: number[] = [lastMoveIndex];

    // Check positive direction
    for (let i = 1; i < WIN_LENGTH; i++) {
      const r = lastRow + dRow * i;
      const c = lastCol + dCol * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
      
      const idx = getIndex(r, c);
      if (board[idx] === player) {
        count++;
        lineIndices.push(idx);
      } else {
        break;
      }
    }

    // Check negative direction
    for (let i = 1; i < WIN_LENGTH; i++) {
      const r = lastRow - dRow * i;
      const c = lastCol - dCol * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;

      const idx = getIndex(r, c);
      if (board[idx] === player) {
        count++;
        lineIndices.push(idx);
      } else {
        break;
      }
    }

    if (count >= WIN_LENGTH) {
      return lineIndices;
    }
  }

  return null;
};