import React from 'react';
import { Player } from '../types';

interface CellProps {
  value: Player;
  index: number;
  isWinningCell: boolean;
  lastMoveIndex: number | null;
  onClick: () => void;
  boardSize: number;
}

export const Cell: React.FC<CellProps> = ({ 
  value, 
  index, 
  isWinningCell, 
  lastMoveIndex,
  onClick, 
  boardSize 
}) => {
  const row = Math.floor(index / boardSize);
  const col = index % boardSize;

  // Logic to determine which borders to draw (to make it look like an intersection)
  // We draw lines inside the cell relative to center
  const isTopEdge = row === 0;
  const isBottomEdge = row === boardSize - 1;
  const isLeftEdge = col === 0;
  const isRightEdge = col === boardSize - 1;
  const isCenterStar = 
    (row === 3 && col === 3) || 
    (row === 3 && col === boardSize - 4) ||
    (row === boardSize - 4 && col === 3) ||
    (row === boardSize - 4 && col === boardSize - 4) ||
    (row === 7 && col === 7);


  return (
    <div 
      className="relative w-full h-full flex items-center justify-center cursor-pointer"
      onClick={onClick}
    >
      {/* Horizontal Line */}
      <div className={`absolute h-[1px] bg-slate-800 ${isLeftEdge ? 'left-1/2 w-1/2' : isRightEdge ? 'right-1/2 w-1/2' : 'w-full'}`}></div>
      
      {/* Vertical Line */}
      <div className={`absolute w-[1px] bg-slate-800 ${isTopEdge ? 'top-1/2 h-1/2' : isBottomEdge ? 'bottom-1/2 h-1/2' : 'h-full'}`}></div>

      {/* Center Star Point (Hoshi) */}
      {isCenterStar && <div className="absolute w-1.5 h-1.5 bg-slate-800 rounded-full z-0"></div>}

      {/* Stone (if present) */}
      {value !== Player.None && (
        <div 
          className={`
            relative z-10 w-[85%] h-[85%] rounded-full shadow-md animate-pop-in
            ${value === Player.Black 
              ? 'bg-gradient-to-br from-slate-800 to-black ring-1 ring-black/10' 
              : 'bg-gradient-to-br from-white to-slate-100 ring-1 ring-slate-300'}
            ${isWinningCell ? 'ring-4 ring-green-500 ring-offset-1' : ''}
          `}
        >
          {/* Last Move Indicator */}
          {lastMoveIndex === index && !isWinningCell && (
             <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${value === Player.Black ? 'bg-white/30' : 'bg-black/30'}`}></div>
          )}
        </div>
      )}
      
      {/* Hover effect target (invisible but clickable) */}
      <div className="absolute inset-0 z-20 hover:bg-black/5 rounded-sm transition-colors duration-100"></div>
    </div>
  );
};