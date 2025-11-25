import React, { useState, useCallback, useEffect } from 'react';
import { Board } from './components/Board';
import { checkWin, getCoords } from './utils/gameLogic';
import { getGeminiMove } from './utils/aiLogic';
import { Player, GameState } from './types';
import { BOARD_SIZE } from './constants';

const INITIAL_STATE: GameState = {
  board: Array(BOARD_SIZE * BOARD_SIZE).fill(Player.None),
  currentPlayer: Player.Black,
  winner: null,
  winningLine: null,
  gameActive: true,
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [lastMoveIndex, setLastMoveIndex] = useState<number | null>(null);
  const [isAiMode, setIsAiMode] = useState<boolean>(false);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);

  // Core logic to apply a move
  const applyMove = useCallback((index: number) => {
    setGameState((prevState) => {
      // Validation inside setter to ensure latest state
      if (!prevState.gameActive || prevState.board[index] !== Player.None) {
        return prevState;
      }

      const newBoard = [...prevState.board];
      newBoard[index] = prevState.currentPlayer;

      const winningLine = checkWin(newBoard, index, prevState.currentPlayer);
      
      let winner: Player | null = null;
      let gameActive = true;
      let nextPlayer = prevState.currentPlayer === Player.Black ? Player.White : Player.Black;

      if (winningLine) {
        winner = prevState.currentPlayer;
        gameActive = false;
      } else if (!newBoard.includes(Player.None)) {
        // Draw
        gameActive = false;
      }

      return {
        board: newBoard,
        currentPlayer: nextPlayer,
        winner,
        winningLine,
        gameActive,
      };
    });
    setLastMoveIndex(index);
  }, []);

  // Handle human clicks
  const handleCellClick = useCallback((index: number) => {
    // If it's AI mode and it's White's turn (AI's turn), ignore clicks
    if (isAiMode && gameState.currentPlayer === Player.White) return;
    
    if (!gameState.gameActive || gameState.board[index] !== Player.None) {
      return;
    }

    applyMove(index);
  }, [gameState.gameActive, gameState.board, gameState.currentPlayer, isAiMode, applyMove]);

  // Handle AI Turn
  useEffect(() => {
    let isMounted = true;

    const executeAiTurn = async () => {
      if (isAiMode && gameState.gameActive && gameState.currentPlayer === Player.White && !isAiThinking) {
        setIsAiThinking(true);
        
        // Small delay for UX
        await new Promise(resolve => setTimeout(resolve, 600));
        if (!isMounted) return;

        const lastMoveCoords = lastMoveIndex !== null ? getCoords(lastMoveIndex) : null;
        
        try {
          const move = await getGeminiMove(gameState.board, lastMoveCoords);
          
          if (isMounted && move) {
            const index = move.row * BOARD_SIZE + move.col;
            // Basic validation
            if (index >= 0 && index < BOARD_SIZE * BOARD_SIZE && gameState.board[index] === Player.None) {
              applyMove(index);
            } else {
              console.warn("AI returned invalid move, skipping turn or random fallback could go here.");
              // Fallback: find first empty slot (simple fallback to prevent lock)
              const firstEmpty = gameState.board.indexOf(Player.None);
              if (firstEmpty !== -1) applyMove(firstEmpty);
            }
          }
        } catch (e) {
          console.error("AI Execution failed", e);
        } finally {
          if (isMounted) setIsAiThinking(false);
        }
      }
    };

    executeAiTurn();

    return () => { isMounted = false; };
  }, [isAiMode, gameState.gameActive, gameState.currentPlayer, gameState.board, lastMoveIndex, isAiThinking, applyMove]);


  const resetGame = () => {
    setGameState(INITIAL_STATE);
    setLastMoveIndex(null);
    setIsAiThinking(false);
  };

  const toggleMode = () => {
    setIsAiMode(!isAiMode);
    resetGame();
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col items-center justify-center font-sans">
      <div className="game-container flex flex-col items-center gap-6 w-full max-w-[640px] p-4">
        
        <header className="text-center relative w-full">
          <h1 className="text-5xl font-extrabold text-slate-800 tracking-tight mb-2">Omok</h1>
          <p className="subtitle text-slate-500 text-lg font-medium tracking-wide uppercase">Classic Strategy Game</p>
          
          <div className="absolute top-0 right-0 hidden md:block">
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${isAiMode ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'}`}>
              {isAiMode ? 'AI Enabled' : 'Local PvP'}
            </span>
          </div>
        </header>

        <div className="status-bar w-full flex flex-col items-center gap-4">
           {/* Mode Toggle */}
           <div className="bg-white p-1 rounded-lg shadow-sm border border-slate-200 flex">
            <button 
              onClick={() => isAiMode && toggleMode()}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${!isAiMode ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Local PvP
            </button>
            <button 
              onClick={() => !isAiMode && toggleMode()}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${isAiMode ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <span>VS Gemini</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sparkles"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            </button>
          </div>

          <div 
            id="status" 
            className="status-text text-2xl text-slate-700 flex items-center justify-center bg-white px-8 py-3 rounded-full shadow-sm border border-slate-200 min-w-[280px] gap-2 transition-all duration-300"
          >
            {gameState.winner ? (
              <span className="text-green-600 font-bold animate-bounce flex items-center gap-2">
                {gameState.winner === Player.Black ? 'Black' : 'White'} Wins!
                <span className="text-2xl">🏆</span>
              </span>
            ) : !gameState.gameActive ? (
               <span className="text-gray-600 font-bold">Draw!</span>
            ) : isAiMode && isAiThinking ? (
                <span className="text-blue-600 font-bold flex items-center gap-2 animate-pulse">
                  <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Gemini is thinking...
                </span>
            ) : (
              <>
                Player 
                <span className={`current-player-indicator font-bold px-2 rounded mx-1 flex items-center gap-1 ${gameState.currentPlayer === Player.Black ? 'text-white bg-slate-800' : 'text-slate-800 bg-white border border-slate-300'}`}>
                  {gameState.currentPlayer === Player.Black ? 'Black' : 'White'}
                  {isAiMode && gameState.currentPlayer === Player.White && <span className="text-xs opacity-70">(AI)</span>}
                </span>
                's Turn
              </>
            )}
          </div>
        </div>

        <div id="board" className="board w-full flex justify-center relative">
          <Board 
            board={gameState.board} 
            onCellClick={handleCellClick} 
            winningLine={gameState.winningLine}
            lastMoveIndex={lastMoveIndex}
          />
        </div>

        <div className="controls mt-4 flex gap-4">
          <button 
            id="reset-btn" 
            className="btn-reset px-8 py-3 bg-slate-800 text-white text-lg font-semibold rounded-lg shadow-lg hover:bg-slate-700 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-800"
            onClick={resetGame}
          >
            Reset Game
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;