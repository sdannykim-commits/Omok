export enum Player {
  None = 0,
  Black = 1,
  White = 2,
}

export interface GameState {
  board: Player[];
  currentPlayer: Player;
  winner: Player | null;
  winningLine: number[] | null; // Indices of the winning cells
  gameActive: boolean;
}

export type Coordinate = {
  row: number;
  col: number;
};