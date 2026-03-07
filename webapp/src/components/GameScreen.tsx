"use client";

import { useState, useEffect, useCallback } from "react";
import "../style/GameScreen.css";

/* Hex Board  */

type HexColor = "white" | "copper" | "silver";
type CellState = "." | "B" | "R";

interface HexTile {
  row: number;
  col: number;
  color: HexColor;
}

// ─── YEN helpers ──────────────────────────────────────────────────────────────

const BOARD_SIZE = 8;
const GAMEY_URL = (import.meta as any).env?.VITE_GAMEY_URL ?? "http://localhost:4000";
const BOT_ID = "random";

interface YEN {
  size: number;
  turn: number; // 0-indexed: 0 = B (human), 1 = R (bot)
  players: string[];
  layout: string;
}

interface BotMove {
  coords: { x: number; y: number; z: number };
}

/**
 * Serializa el estado del tablero (array plano de celdas) al formato YEN.
 * Las filas en YEN van de menor a mayor: fila 0 = 1 celda (cima), fila size-1 = size celdas (base).
 */
function serializeLayout(cells: CellState[], size: number): string {
  const rows: string[] = [];
  let idx = 0;
  for (let row = 0; row < size; row++) {
    rows.push(cells.slice(idx, idx + row + 1).join(""));
    idx += row + 1;
  }
  return rows.join("/");
}

/**
 * Convierte coordenadas baricéntricas (x, y) a índice plano del array de celdas.
 * Espejo de Coordinates::to_index en Rust.
 */
function coordsToIndex(x: number, y: number, size: number): number {
  const r = size - 1 - x;
  return (r * (r + 1)) / 2 + y;
}

/**
 * Pide al bot su siguiente movimiento dado un estado YEN.
 * POST /v1/ybot/choose/{botId}
 */
async function askBot(yen: YEN): Promise<BotMove> {
  const res = await fetch(`${GAMEY_URL}/v1/ybot/choose/${BOT_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(yen),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Bot error ${res.status}`);
  }
  return res.json();
}

// ─── Board generation ─────────────────────────────────────────────────────────

/**
 * Crea el tablero como un array de tiles con su posición (x,y) y color.
 * El color se deriva del estado de la celda correspondiente.
 */
function generateBoard(cells: CellState[]): HexTile[] {
  const tiles: HexTile[] = [];
  const totalRows = BOARD_SIZE;
  let idx = 0;

  for (let row = 0; row < totalRows; row++) {
    const cols = totalRows - row;

    for (let col = 0; col < cols; col++) {
      // YEN fila 0 = cima (1 celda). La fila visual más grande (base) = row 0 original.
      // Mapeamos: fila visual row → fila YEN (size-1-row), de mayor a menor.
      const yenRow = totalRows - 1 - row;
      const yenIdx = (yenRow * (yenRow + 1)) / 2 + col; // índice plano en YEN

      let color: HexColor = "white";
      if (cells[yenIdx] === "B") color = "copper";
      else if (cells[yenIdx] === "R") color = "silver";

      tiles.push({ row, col, color });
      idx++;
    }
  }
  return tiles;
}

// ─── HexBoard component ───────────────────────────────────────────────────────

interface HexBoardProps {
  cells: CellState[];
  onTileClick: (yenIndex: number) => void;
  disabled: boolean;
}

/**
 * Crea el tablero visualmente, como composición de botones.
 * Al hacer click en un tile se calcula su índice YEN y se llama a onTileClick.
 */
function HexBoard({ cells, onTileClick, disabled }: HexBoardProps) {
  const tiles = generateBoard(cells);
  const hexW = 56; //Tamaño de cada casilla/hexágono en pixeles
  const hexH = 48;
  const gapX = 4; //Separación entre casillas
  const gapY = -4;

  return (
    <div className="hex-board" aria-label="Game board">
      {tiles.map((tile, i) => { /*Por cada tile, creo un botón. Calculo su posición con los cálculos de abajo. */
        const totalRows = BOARD_SIZE;
        const cols = totalRows - tile.row; //Columnas de esta fila.

        const rowWidth = cols * (hexW + gapX) - gapX;
        const maxRowWidth = totalRows * (hexW + gapX) - gapX;

        const offsetX = (maxRowWidth - rowWidth) / 2; //Para centrar cada fila.

        const x = offsetX + tile.col * (hexW + gapX); //Posición del botón.
        const y = (totalRows - 1 - tile.row) * (hexH + gapY);

        // Índice YEN correspondiente a este tile visual
        const yenRow = totalRows - 1 - tile.row;
        const yenIndex = (yenRow * (yenRow + 1)) / 2 + tile.col;
        const isEmpty = cells[yenIndex] === ".";

        return (
          <button
            key={i}
            className={`hex-tile hex-tile--${tile.color}`}
            /*Por ejemplo: (hex-tile hex-tile--white)*/
            style={{
              /*Posición y tamaño --> TODO: Revisar si esto es correcto, al usar etiqueta style en el codigo.*/
              left: `${x}px`,
              top: `${y}px`,
              width: `${hexW}px`,
              height: `${hexH}px`,
            }}
            aria-label={`Tile row ${tile.row} column ${tile.col}, ${tile.color}`}
            disabled={disabled || !isEmpty}
            onClick={() => onTileClick(yenIndex)}
          >
            <svg viewBox="0 0 100 87" className="hex-svg">
              {/*TODO: Revisar si funciona bien.*/}
              <polygon points="25,0 75,0 100,43.5 75,87 25,87 0,43.5" />
              {/*Hexágono creado con svg.*/}
            </svg>
          </button>
        );
      })}
    </div>
  );
}

/* ── Timer Display ── */

function TimerDisplay({
  label,
  minutes,
  seconds,
}: {
  label: string;
  minutes: number;
  seconds: number;
}) {
  const mm = String(minutes).padStart(1, "0");
  const ss = String(seconds).padStart(2, "0");

  return (
    <div className="timer-box">
      <span className="timer-label">{label}</span>
      <span className="timer-digits">
        {mm}:{ss}
      </span>
    </div>
  );
}

/* ── Chat Section ── */

function ChatSection() {
  const [message, setMessage] = useState(""); //Utilizo estado de React para poder guardar los mensajes más adelante.

  return (
    /*Contenedor del chat*/
    <div className="chat-section">

      {/*Header del chat (avatar, título)*/}
      <div className="chat-header">

        <div className="chat-avatar">
          <svg
            width="36"
            height="36"
            viewBox="0 0 36 36"
            fill="none"
            aria-hidden="true"
          >
            {/*SVG para hacer la figura del paisano. TEMPORAL!! TODO-> Añadir una imagen predeterminada. */}
            <circle cx="18" cy="18" r="18" fill="#c8d0da" />
            <circle cx="18" cy="14" r="6" fill="#9aa4b0" />
            <ellipse cx="18" cy="30" rx="10" ry="7" fill="#9aa4b0" />
          </svg>
        </div>

        <span className="chat-title">Chat</span>

      </div>

      {/*Contenedor de los mensajes del chat*/}
      <div className="chat-input-area">
        <textarea
          className="chat-input"
          placeholder="Type a message..."
          value={message} //Value guarda el mensaje del usuario, y onChange lo actualiza cada vez que el usuario escribe algo.
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          aria-label="Type a message"
        />
        <button className="chat-send-btn" aria-label="Send message">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* Whole Screen  */

interface GameScreenProps {
  onSurrender?: () => void;
}

export default function GameScreen({ onSurrender }: GameScreenProps) {
  const totalCells = (BOARD_SIZE * (BOARD_SIZE + 1)) / 2; // 36 celdas

  // Estado del tablero: array plano en orden YEN (fila 0 = cima)
  const [cells, setCells] = useState<CellState[]>(Array(totalCells).fill(".")); //TODO -> Cargar estado desde el backend cuando esté disponible.
  const [botThinking, setBotThinking] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [playerTime, setPlayerTime] = useState(20); //Tiempo inicial del jugador en segundos. TODO -> Cambiar tiempo.
  const [opponentTime] = useState(0);

  const tick = useCallback(() => { //Función que se llama cada segundo para actualizar el tiempo del jugador.
    if (!botThinking) setPlayerTime((t) => (t > 0 ? t - 1 : 0));
  }, [botThinking]);

  useEffect(() => { //Llama a tick cada segundo.
    const id = setInterval(tick, 1000);
    return () => clearInterval(id); //Limpia el intervalo al desmontar el componente.
  }, [tick]);

  /**
   * Maneja el click del jugador humano (B) en un tile.
   * 1. Coloca la ficha del jugador.
   * 2. Envía el estado al bot y coloca su respuesta (R).
   */
  const handleTileClick = async (yenIndex: number) => {
    if (botThinking || cells[yenIndex] !== ".") return;

    // 1. Colocar ficha del jugador (B)
    const afterHuman = [...cells];
    afterHuman[yenIndex] = "B";
    setCells(afterHuman);
    setStatusMsg(null);

    // 2. Pedir movimiento al bot (turno de R = índice 1)
    setBotThinking(true);
    const yen: YEN = {
      size: BOARD_SIZE,
      turn: 1, // ahora le toca a R
      players: ["B", "R"],
      layout: serializeLayout(afterHuman, BOARD_SIZE),
    };

    try {
      const botMove = await askBot(yen);
      const { x, y } = botMove.coords;
      const botIndex = coordsToIndex(x, y, BOARD_SIZE);

      const afterBot = [...afterHuman];
      afterBot[botIndex] = "R";
      setCells(afterBot);
    } catch (err: any) {
      setStatusMsg(`Bot error: ${err.message}`);
    } finally {
      setBotThinking(false);
    }
  };

  const pMin = Math.floor(playerTime / 60);
  const pSec = playerTime % 60;
  const oMin = Math.floor(opponentTime / 60);
  const oSec = opponentTime % 60;

  return (
    <div className="game-screen">

      {/* Top Bar [Titulo y ajustes] */}
      <header className="game-topbar">

        <div className="game-logo">

          <div className="game-logo-icon" aria-hidden="true">
            <span>Y</span>
          </div>
          <span className="game-logo-text">YOVI</span>

        </div>

        <button className="game-settings-btn" aria-label="Settings">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </header>

      {/*  Main Content[Tablero + Contador + Boton Rendirse + Chat]  */}
      <div className="game-body">
        {/*  Board Area */}
        <div className="game-board-area">
          <HexBoard
            cells={cells}
            onTileClick={handleTileClick}
            disabled={botThinking}
          />
          {botThinking && (
            <div style={{ marginTop: 8, textAlign: "center", color: "#888" }}>
              Bot is thinking…
            </div>
          )}
          {statusMsg && (
            <div style={{ marginTop: 8, textAlign: "center", color: "red" }} role="alert">
              {statusMsg}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="game-sidebar">
          {/* Timers */}
          <div className="game-timers">
            <TimerDisplay label="Player" minutes={pMin} seconds={pSec} />
            <TimerDisplay label="Opponent" minutes={oMin} seconds={oSec} />
          </div>

          {/* Surrender */}
          <button
            className="game-surrender-btn"
            onClick={onSurrender}
          >
            {"Surrender"}
          </button>

          {/* Chat */}
          <ChatSection />
        </aside>
      </div>
    </div>
  );
}