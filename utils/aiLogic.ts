
import { GoogleGenAI, Type } from "@google/genai";
import { BOARD_SIZE } from "../constants";
import { Player } from "../types";

export const getGeminiMove = async (
  board: Player[], 
  lastMove: {row: number, col: number} | null,
  apiKey: string
): Promise<{ row: number; col: number } | null> => {
  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    // Create a visual representation of the board for the model
    // Using 00-14 for clearer column alignment
    let boardVisual = "   00 01 02 03 04 05 06 07 08 09 10 11 12 13 14\n";
    for (let r = 0; r < BOARD_SIZE; r++) {
      boardVisual += `${r.toString().padStart(2, '0')} `;
      for (let c = 0; c < BOARD_SIZE; c++) {
        const index = r * BOARD_SIZE + c;
        const cell = board[index];
        let symbol = ". ";
        if (cell === Player.Black) symbol = "X "; // Black
        if (cell === Player.White) symbol = "O "; // White
        boardVisual += symbol + " ";
      }
      boardVisual += "\n";
    }

    const prompt = `
      You are an expert Gomoku (Omok) AI player.
      You are playing as White (O). The opponent (User) is Black (X).
      The board is 15x15. The goal is to get exactly 5 stones in a row (horizontal, vertical, or diagonal).
      
      Current Board State:
      ${boardVisual}
      
      ${lastMove ? `Opponent's last move was row: ${lastMove.row}, col: ${lastMove.col}.` : "Opponent just started."}
      
      Analyze the board strategy:
      1. DEFENSE: Check if the opponent (X) has 3 or 4 in a row that needs immediate blocking. This is your top priority.
      2. OFFENSE: Check if you (O) can form 5 in a row to win immediately.
      3. BUILD: If no immediate threats or winning moves, place a stone to build potential lines (3s or 4s).
      
      Return your move as a JSON object with 'row' and 'col'.
      IMPORTANT: Do not choose a coordinate that already has 'X' or 'O'.
      The coordinates must be integers between 0 and 14.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            row: { type: Type.INTEGER },
            col: { type: Type.INTEGER },
          },
          required: ["row", "col"],
        },
        temperature: 0.2, // Lower temperature for more deterministic/strategic play
        thinkingConfig: { thinkingBudget: 0 }, // Disable thinking for speed
      },
    });

    const text = response.text;
    if (!text) return null;
    
    // Clean up potential markdown formatting just in case
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const move = JSON.parse(cleanText);
    return move;
  } catch (error) {
    console.error("Error getting AI move:", error);
    return null;
  }
};
