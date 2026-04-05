USE users_db;

CREATE TABLE IF NOT EXISTS games (
  id VARCHAR(36) PRIMARY KEY,
  player1_id INT NOT NULL,
  config JSON NOT NULL,
  status ENUM('waiting', 'playing', 'finished', 'abandoned') NOT NULL DEFAULT 'playing',
  board_state JSON NOT NULL,
  players JSON NOT NULL,
  current_turn ENUM('player1', 'player2') NOT NULL DEFAULT 'player1',
  winner ENUM('player1', 'player2') NULL DEFAULT NULL,
  timer_state JSON NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS game_moves (
  id INT AUTO_INCREMENT PRIMARY KEY,
  game_id VARCHAR(36) NOT NULL,
  player_color ENUM('player1', 'player2') NOT NULL,
  row_index INT NOT NULL,
  col_index INT NOT NULL,
  move_timestamp BIGINT NOT NULL,
  played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
