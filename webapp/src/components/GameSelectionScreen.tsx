"use client";

import { useNavigate } from "react-router-dom";
import { useState } from "react";
import "../style/GameSelectionScreen.css";

interface Game {
    id: string;
    name: string;
    description: string;
    imageURL: string;
}

interface GameSelectionScreenProps{
    onSelectGame?: (gameId: string) => void; //función que redirige al juego elegido
    onBack?: () => void; //vuelve al login (en principio) 
}

const games: Game[] = [
    {
        id: "gamey",
        name: "Game Y",
        description:"A strategic tile-based game where players compete to control the pyramid.",
        imageURL: "/GameY-Image.jpeg", 
    }
]; //TODO -> no hardcodear la lista de juegos estaría bien

const gameRoutes: Record<string, string> = {
  gamey: "/gamey",
  
};

export default function GameSelectionScreen( {onSelectGame, onBack} : GameSelectionScreenProps){

const [selectedGame, setSelectedGame] = useState<Game>(games[0]);
const navigate = useNavigate();

const handleGameClick = (game: Game) => {
    setSelectedGame(game);
};

const handlePlayClick = () => {
    onSelectGame?.(selectedGame.id);
    const route = gameRoutes[selectedGame.id] ?? "/gameSelection"; 
    navigate(route);
};

  const handleBack = () => {
    onBack?.();
    navigate("/"); // vuelve al login
  };

return (
    <div className="selection-screen">
      {/* Imagen del juego seleccionado */}
      <div className="selection-preview">
        <img
          src={selectedGame.imageURL}
          alt={selectedGame.name}
          className="selection-preview-image"
        />
        <div className="selection-preview-overlay">
          <h2 className="selection-preview-title">{selectedGame.name}</h2>
          <p className="selection-preview-description">{selectedGame.description}</p>
        </div>
      </div>

      <div className="selection-sidebar">
        {/* Logo YOVI */}
        <div className="selection-logo">
          <div className="selection-logo-icon" aria-hidden="true">
            <span>Y</span>
          </div>
          <span className="selection-logo-text">YOVI</span>
        </div>

        <h1 className="selection-title">Select a Game</h1>

        {/* Lista con todos los juegos */}
        <div className="selection-list">
          {games.map((game) => ( /*itero sobre la lista de juegos y creo un boton por cada uno*/
            <button 
                key={game.id} className={`selection-game-card ${selectedGame.id === game.id ? "selection-game-card--active" : ""}`}
                onClick={() => handleGameClick(game)}
                aria-pressed={selectedGame.id === game.id}
            > {/*Al boton le meto imagen nombre descripcion del juego.*/}
              <div className="selection-game-thumb">
                <img src={game.imageURL} alt="" />
              </div>
              <div className="selection-game-info">
                <h3 className="selection-game-name">{game.name}</h3>
                <p className="selection-game-desc">{game.description}</p>
              </div>
              {selectedGame.id === game.id && (
                <div className="selection-game-check">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  > {/*esto es un check */}
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
        {/* Botones */}
        <div className="selection-actions">
          <button className="selection-play-btn" onClick={handlePlayClick}>
            Play Now
          </button>
          <button className="selection-back-btn" onClick={handleBack}>
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
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
