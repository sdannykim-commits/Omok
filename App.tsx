
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
  const [scores, setScores] = useState<{ [key in Player]: number }>({
    [Player.Black]: 0,
    [Player.White]: 0,
    [Player.None]: 0
  });

  // API Key State
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>('');
  
  // Load API Key on Mount
  useEffect(() => {
    const storedKey = getApiKey();
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, []);

  // Core logic to apply a move
  const applyMove = useCallback((index: number) => {
    setGameState((prevState) => {
      // Guard: Double check valid move in state update
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
        currentPlayer: nextPlayer, // Step 2: Update state to explicitly indicate next turn
        winner,
        winningLine,
        gameActive,
      };
    });
    setLastMoveIndex(index);
    setTimeLeft(TURN_TIME_LIMIT); // Reset timer on move
  }, []);

  // Handle Score Update
  useEffect(() => {
    if (gameState.winner) {
      setScores(prev => ({
        ...prev,
        [gameState.winner!]: prev[gameState.winner!] + 1
      }));
    }
  }, [gameState.winner]);

  // Handle Timeout
  const handleTimeout = useCallback(() => {
    setGameState((prev) => {
      const winner = prev.currentPlayer === Player.Black ? Player.White : Player.Black;
      return {
        ...prev,
        gameActive: false,
        winner: winner, 
      };
    });
  }, []);

  // Timer Countdown Effect
  useEffect(() => {
    if (!gameState.gameActive || gameState.winner) return;

    // Timer runs to enforce limits
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
    // Guard: Strict prevention of interaction during AI turn or thinking state
    if (isAiMode && (gameState.currentPlayer === Player.White || isAiThinking)) return;
    
    if (!gameState.gameActive || gameState.board[index] !== Player.None) {
      return;
    }

    // Step 1: Validate and place Player's stone
    applyMove(index);
  }, [gameState.gameActive, gameState.board, gameState.currentPlayer, isAiMode, isAiThinking, applyMove]);

  // Handle AI Turn
  useEffect(() => {
    let isMounted = true;
    let turnDelayTimer: ReturnType<typeof setTimeout>;
    let renderYieldTimer: ReturnType<typeof setTimeout>;

    const executeAiTurn = async () => {
      // Step 3: AI Move Guard
      // Check strict conditions: AI Mode ON, Game Active, Current Player is White (AI), and NOT already thinking
      if (isAiMode && gameState.gameActive && gameState.currentPlayer === Player.White && !isAiThinking) {
        
        // VISUAL FIX: Introduce a delay to ensure the Player's move is fully rendered 
        // and prevent the "simultaneous move" effect.
        await new Promise(resolve => {
            turnDelayTimer = setTimeout(resolve, 600); 
        });

        if (!isMounted) return;

        // Re-check guards after delay
        if (!gameState.gameActive || gameState.currentPlayer !== Player.White) return;

        console.log("AI Turn Starting... Board State:", gameState.board);

        setIsAiThinking(true);
        
        // PERFORMANCE FIX: Yield to main thread to allow "Thinking..." UI to paint 
        await new Promise(resolve => {
            renderYieldTimer = setTimeout(resolve, 50);
        });

        if (!isMounted) return;
        
        try {
          const lastMoveCoords = lastMoveIndex !== null ? getCoords(lastMoveIndex) : null;
          
          // Calculate Move (Synchronous CPU intensive task)
          // Pass the user-configured apiKey
          const move = await getGeminiMove(gameState.board, lastMoveCoords, apiKey);
          console.log("AI Move Calculation Finished. Result:", move);
          
          if (isMounted) {
            let index = -1;
            
            // Validate AI move
            if (move) {
              const aiIndex = move.row * BOARD_SIZE + move.col;
              if (aiIndex >= 0 && aiIndex < BOARD_SIZE * BOARD_SIZE && gameState.board[aiIndex] === Player.None) {
                index = aiIndex;
              } else {
                console.warn("AI returned occupied or out-of-bounds move:", move);
              }
            }

            // Fallback for valid logic failure (not auth failure)
            if (index === -1) {
              console.warn("Using random fallback for AI move.");
              const emptyIndices = gameState.board
                .map((cell, idx) => cell === Player.None ? idx : -1)
                .filter(idx => idx !== -1);
              
              if (emptyIndices.length > 0) {
                const randomIdx = Math.floor(Math.random() * emptyIndices.length);
                index = emptyIndices[randomIdx];
              }
            }

            // Step 4: Final Transition - Apply AI move and return turn to Player
            if (index !== -1) {
               applyMove(index);
            }
          }
        } catch (e: any) {
          console.error("AI Execution failed", e);
          
          // CRITICAL SECURITY HANDLING
          // If the error is due to missing credentials, STOP execution.
          // Do NOT trigger the random fallback.
          if (e.message && e.message.includes("SECURITY_ERR_AUTH_REQUIRED")) {
             if (isMounted) {
               setIsAiThinking(false);
               setIsApiKeyModalOpen(true);
               // We do NOT call applyMove here, effectively pausing the game until key is provided.
             }
             return;
          }

          // Fallback only on non-security crashes
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
          if (isMounted) {
             setIsAiThinking(false);
             console.log("AI Turn Phase Complete.");
          }
        }
      }
    };

    executeAiTurn();

    return () => { 
        isMounted = false; 
        clearTimeout(turnDelayTimer);
        clearTimeout(renderYieldTimer);
    };
  }, [isAiMode, gameState.gameActive, gameState.currentPlayer, gameState.board, lastMoveIndex, applyMove, apiKey]);

  const resetGame = () => {
    setGameState(INITIAL_STATE);
    setLastMoveIndex(null);
    setIsAiThinking(false);
    setTimeLeft(TURN_TIME_LIMIT);
  };

  const toggleMode = () => {
    setIsAiMode(!isAiMode);
    resetGame();
    setScores({ [Player.Black]: 0, [Player.White]: 0, [Player.None]: 0 });
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col items-center justify-center font-sans">
      <div className="game-container flex flex-col items-center gap-6 w-full max-w-[640px] p-4">
        
        <header className="text-center relative w-full flex justify-center items-center mb-2">
          {/* API Key Settings Button */}
          <button 
            onClick={() => setIsApiKeyModalOpen(true)}
            className={`absolute right-0 top-1/2 transform -translate-y-1/2 p-2 rounded-full transition-all ${!apiKey ? 'text-red-500 bg-red-50 animate-pulse ring-2 ring-red-200' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
            title={!apiKey ? "API Key Required!" : "Configure API Key"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>

          <div className="flex flex-col items-center">
            <h1 className="text-5xl font-extrabold text-slate-800 tracking-tight mb-2">Omok</h1>
            <p className="subtitle text-slate-500 text-lg font-medium tracking-wide uppercase">Classic Strategy Game</p>
          </div>
        </header>

        {/* Scoreboard */}
        <div className="flex justify-between w-full max-w-[400px] animate-pop-in">
          <div className="flex flex-col items-center justify-center p-3 bg-slate-800 text-white rounded-xl shadow-lg w-32 border-2 border-slate-700">
            <span className="text-xs uppercase tracking-wider opacity-80 mb-1">Black</span>
            <span className="text-4xl font-bold">{scores[Player.Black]}</span>
          </div>
          
          <div className="flex items-center justify-center text-slate-400 font-bold text-xl px-2">
            VS
          </div>

          <div className="flex flex-col items-center justify-center p-3 bg-white text-slate-800 rounded-xl shadow-lg w-32 border-2 border-slate-200">
            <span className="text-xs uppercase tracking-wider opacity-60 mb-1">White</span>
            <span className="text-4xl font-bold">{scores[Player.White]}</span>
          </div>
        </div>

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
        isOpen={isApiKeyModalOpen} 
        onClose={() => setIsApiKeyModalOpen(false)}
        onSave={setApiKey}
      />
    </div>
  );
};

export default App;
