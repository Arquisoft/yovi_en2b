"use client";

import React, { useState, useEffect, useCallback } from "react";
import "../style/GameScreen.css";

/* Hex Board  */

type HexColor = "white" | "copper" | "silver";

interface HexTile {
  row: number;
  col: number;
  color: HexColor;
}

/**
 * Crea el tablero como un array de tiles con su posición (x,y) y color. 
 * @returns 
 */
function generateBoard(): HexTile[] {//TODO -> Comprobar si lo puedo pasar a YEN notation asi, o tengo que cambiar la forma de hacer el tablero.
  const tiles: HexTile[] = [];
  const totalRows = 8;

  for (let row = 0; row < totalRows; row++) {
    const cols = totalRows - row;

    for (let col = 0; col < cols; col++) {
      let color: HexColor = "white";

      tiles.push({ row, col, color });
    }
  }
  return tiles;
}

/**
 * Crea el talero visualmente, como composición de botonesñ.
 * @returns 
 */
function HexBoard() {
  const tiles = generateBoard();
  const hexW = 56;//Tamaño de cada casilla/hexágono en pixeles
  const hexH = 48;
  const gapX = 4;//Separación entre casillas
  const gapY = -4;

  return (
    
    <div className="hex-board" aria-label="Game board">
      {tiles.map((tile, i) => { //Por cada tile, creo un botón. Calulo su posicion con los calculos de debajo. 
        const totalRows = 8;
        const cols = totalRows - tile.row; //Columnas de esta fila.

        const rowWidth = cols * (hexW + gapX) - gapX;
        const maxRowWidth = totalRows * (hexW + gapX) - gapX;

        const offsetX = (maxRowWidth - rowWidth) / 2; //Para centrar cada fila.

        const x = offsetX + tile.col * (hexW + gapX); //Posición del botón.
        const y = (totalRows - 1 - tile.row) * (hexH + gapY);

        return (
          <button
            key={i}
            className={`hex-tile hex-tile--${tile.color}`} {//Por ejemplo: (hex-tile hex-tile--white)}
            style={{ {//Posición y tamaño --> TODO: Revisar si esto es correcto, al usar etiqueta style en el codigo.}
              left: `${x}px`,
              top: `${y}px`,
              width: `${hexW}px`,
              height: `${hexH}px`,
            }}
            aria-label={`Tile row ${tile.row} column ${tile.col}, ${tile.color}`}
          >
            <svg viewBox="0 0 100 87" className="hex-svg"> {//TODO: Revisar si funciona bien.}
              <polygon points="25,0 75,0 100,43.5 75,87 25,87 0,43.5" /> {//Hexágono creado con svg. }
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
  const [message, setMessage] = useState(""); //Utilizo estado de React para poder guardar los mnsjes más adelante.

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
  const [playerTime, setPlayerTime] = useState(20); //Tiempo inicial del jugador en segundos. TODO -> Cambiar tiempo.
  const [opponentTime] = useState(0);

  const tick = useCallback(() => {//Función que se llama cada segundo para actualizar el tiempo del jugador.
    setPlayerTime((t) => (t > 0 ? t - 1 : 0));
  }, []);

  useEffect(() => { //Llama a tick cada segundo.
    const id = setInterval(tick, 1000);
    return () => clearInterval(id); //Limpia el intervalo al desmontar el componente.
  }, [tick]);

  const pMin = Math.floor(playerTime / 60);
  const pSec = playerTime % 60;
  const oMin = Math.floor(opponentTime / 60);
  const oSec = opponentTime % 60;

  return (
    <div className="game-screen">

      {/* Top Bar [Titulo y ajusres] */}
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
          <HexBoard />
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
