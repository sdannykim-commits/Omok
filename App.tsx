
import React, { useState, useCallback, useEffect } from 'react';
import { Board } from './components/Board';
import { ApiKeyModal } from './components/ApiKeyModal';
import { checkWin, getCoords } from './utils/gameLogic';
import { getGeminiMove } from './utils/aiLogic';
import { getApiKey } from './utils/secureStorage';
import { Player, GameState } from './types';
import { BOARD_SIZE, TURN_TIME_LIMIT } from './constants';

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
  const [timeLeft, setTimeLeft] = useState<number>(TURN_TIME_LIMIT);
  
  // API Key State
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);

  // Load key on mount
  useEffect(() => {
    const storedKey = getApiKey();
    if (storedKey) setApiKey(storedKey);
  }, []);

  // Core logic to apply a move
  const applyMove = useCallback((index: number) => {
    setGameState((prevState) => {
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
    setTimeLeft(TURN_TIME_LIMIT); // Reset timer on move
  }, []);

  // Handle Timeout
  const handleTimeout = useCallback(() => {
    setGameState((prev) => ({
      ...prev,
      gameActive: false,
      winner: prev.currentPlayer === Player.Black ? Player.White : Player.Black, // Opponent wins
    }));
  }, []);

  // Timer Countdown Effect
  useEffect(() => {
    if (!gameState.gameActive || gameState.winner) return;

    // Timer now runs even during AI turn to enforce the 10s limit
    const timerId = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerId);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [gameState.currentPlayer, gameState.gameActive, gameState.winner, handleTimeout]);

  // Handle human clicks
  const handleCellClick = useCallback((index: number) => {
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
      // Logic checks: AI Mode ON, Game Active, Current Player is White (AI), and not already thinking
      if (isAiMode && gameState.gameActive && gameState.currentPlayer === Player.White && !isAiThinking) {
        if (!apiKey) {
          setIsKeyModalOpen(true);
          return;
        }

        setIsAiThinking(true);
        
        // Small delay to let UI render the thinking state, but kept short
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!isMounted) return;

        const lastMoveCoords = lastMoveIndex !== null ? getCoords(lastMoveIndex) : null;
        
        try {
          // Attempt to get move from Gemini
          const move = await getGeminiMove(gameState.board, lastMoveCoords, apiKey);
          
          if (isMounted) {
            let index = -1;
            
            // Validate AI move
            if (move) {
              const aiIndex = move.row * BOARD_SIZE + move.col;
              if (aiIndex >= 0 && aiIndex < BOARD_SIZE * BOARD_SIZE && gameState.board[aiIndex] === Player.None) {
                index = aiIndex;
              }
            }

            // Fallback: If AI returned null or invalid move, pick a random valid empty spot
            if (index === -1) {
              console.warn("AI returned invalid/null move. Using random fallback.");
              const emptyIndices = gameState.board
                .map((cell, idx) => cell === Player.None ? idx : -1)
                .filter(idx => idx !== -1);
              
              if (emptyIndices.length > 0) {
                const randomIdx = Math.floor(Math.random() * emptyIndices.length);
                index = emptyIndices[randomIdx];
              }
            }

            // Apply the move if we found a valid index
            if (index !== -1) {
               applyMove(index);
            }
          }
        } catch (e) {
          console.error("AI Execution failed completely", e);
          // Fallback on crash
           if (isMounted) {
              const emptyIndices = gameState.board
                .map((cell, idx) => cell === Player.None ? idx : -1)
                .filter(idx => idx !== -1);
               if (emptyIndices.length > 0) {
                 const randomIdx = Math.floor(Math.random() * emptyIndices.length);
                 applyMove(emptyIndices[randomIdx]);
               }
           }
        } finally {
          if (isMounted) setIsAiThinking(false);
        }
      }
    };

    executeAiTurn();

    return () => { isMounted = false; };
  }, [isAiMode, gameState.gameActive, gameState.currentPlayer, gameState.board, lastMoveIndex, isAiThinking, applyMove, apiKey]);

  const resetGame = () => {
    setGameState(INITIAL_STATE);
    setLastMoveIndex(null);
    setIsAiThinking(false);
    setTimeLeft(TURN_TIME_LIMIT);
  };

  const toggleMode = () => {
    if (!isAiMode && !apiKey) {
      setIsKeyModalOpen(true);
      return;
    }
    setIsAiMode(!isAiMode);
    resetGame();
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col items-center justify-center font-sans">
      <div className="game-container flex flex-col items-center gap-6 w-full max-w-[640px] p-4">
        
        <header className="text-center relative w-full flex justify-center items-center mb-2">
          <div className="flex flex-col items-center">
            <h1 className="text-5xl font-extrabold text-slate-800 tracking-tight mb-2">Omok</h1>
            <p className="subtitle text-slate-500 text-lg font-medium tracking-wide uppercase">Classic Strategy Game</p>
          </div>
          
          <div className="absolute top-2 right-0 flex gap-2">
             <button 
              onClick={() => setIsKeyModalOpen(true)}
              className="bg-white p-2 rounded-full shadow-md text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors border border-slate-200"
              title="Configure API Key"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
            </button>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            </button>
          </div>

          <div 
            id="status" 
            className="status-text text-xl text-slate-700 flex items-center justify-between bg-white px-6 py-2 rounded-full shadow-sm border border-slate-200 min-w-[320px] gap-4 transition-all duration-300"
          >
            {/* Status Message */}
            <div className="flex items-center gap-2 flex-1 justify-center">
              {gameState.winner ? (
                <span className="text-green-600 font-bold animate-bounce flex items-center gap-2">
                  {gameState.winner === Player.Black ? 'Black' : 'White'} Wins!
                  <span className="text-2xl">🏆</span>
                </span>
              ) : !gameState.gameActive && !gameState.winner && timeLeft === 0 ? (
                 <span className="text-red-600 font-bold">Time Out! {gameState.currentPlayer === Player.Black ? 'White' : 'Black'} Wins</span>
              ) : !gameState.gameActive ? (
                 <span className="text-gray-600 font-bold">Draw!</span>
              ) : isAiMode && isAiThinking ? (
                  <span className="text-blue-600 font-bold flex items-center gap-2 animate-pulse">
                    <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Thinking...
                  </span>
              ) : (
                <>
                  <span className={`current-player-indicator font-bold px-2 py-0.5 rounded flex items-center gap-1 ${gameState.currentPlayer === Player.Black ? 'text-white bg-slate-800' : 'text-slate-800 bg-white border border-slate-300'}`}>
                    {gameState.currentPlayer === Player.Black ? 'Black' : 'White'}
                    {isAiMode && gameState.currentPlayer === Player.White && <span className="text-xs opacity-70">(AI)</span>}
                  </span>
                  's Turn
                </>
              )}
            </div>

            {/* Timer Display */}
            {gameState.gameActive && !gameState.winner && (
              <div className={`
                flex items-center justify-center w-10 h-10 rounded-full border-2 font-mono font-bold text-lg transition-colors
                ${timeLeft <= 3 ? 'border-red-500 text-red-600 bg-red-50 animate-pulse' : 
                  timeLeft <= 5 ? 'border-orange-400 text-orange-600' : 
                  'border-slate-200 text-slate-600'}
              `}>
                {timeLeft}
              </div>
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
      
      <ApiKeyModal 
        isOpen={isKeyModalOpen} 
        onClose={() => setIsKeyModalOpen(false)} 
        onSave={(key) => {
          setApiKey(key);
          if (!isAiMode) {
             setIsAiMode(true);
             resetGame();
          }
        }}
      />
    </div>
  );
};

export default App;
