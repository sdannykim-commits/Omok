import React from 'react';
import { Cell } from './Cell';
import { Player } from '../types';
import { BOARD_SIZE } from '../constants';

interface BoardProps {
  board: Player[];
  onCellClick: (index: number) => void;
  winningLine: number[] | null;
  lastMoveIndex: number | null;
}

export const Board: React.FC<BoardProps> = ({ board, onCellClick, winningLine, lastMoveIndex }) => {
  return (
    <div className="relative p-4 bg-wood-400 rounded-lg shadow-2xl border-4 border-wood-600 w-full aspect-square max-w-[600px]">
      {/* Wood texture overlay */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-20 pointer-events-none rounded-lg"></div>
      
      <div 
        className="grid relative z-10 w-full h-full"
        style={{
          gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
        }}
      >
        {board.map((cellValue, index) => (
          <Cell
            key={index}
            index={index}
            value={cellValue}
            boardSize={BOARD_SIZE}
            isWinningCell={winningLine?.includes(index) ?? false}
            lastMoveIndex={lastMoveIndex}
            onClick={() => onCellClick(index)}
          />
        ))}
      </div>
    </div>
  );
};