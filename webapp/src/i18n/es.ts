const es = {
  // ── Common ──────────────────────────────────────────────────────────────────
  common: {
    back: 'Volver',
    cancel: 'Cancelar',
    loading: 'Cargando...',
    error: 'Error',
    save: 'Guardar',
    confirm: 'Confirmar',
    close: 'Cerrar',
    or: 'o',
    minutes: 'minutos',
    minute: 'minuto',
  },

  // ── App / Branding ───────────────────────────────────────────────────────────
  app: {
    loading: 'Cargando YOVI...',
    name: 'YOVI',
  },

  // ── Navigation ───────────────────────────────────────────────────────────────
  nav: {
    toggleTheme: 'Cambiar tema',
    statistics: 'Estadísticas',
    ranking: 'Clasificación',
    history: 'Historial de partidas',
    logout: 'Cerrar sesión',
    guestBadge: 'Invitado',
    signOut: 'Cerrar sesión',
    signOutConfirmTitle: 'Cerrar sesión',
    signOutConfirmDescription: '¿Seguro que quieres cerrar sesión?',
  },

  // ── Auth ─────────────────────────────────────────────────────────────────────
  auth: {
    welcomeTitle: 'Bienvenido a YOVI',
    welcomeSubtitle: 'Inicia sesión para continuar',
    email: 'Correo electrónico',
    emailPlaceholder: 'tú@ejemplo.com',
    password: 'Contraseña',
    passwordPlaceholder: 'Introduce tu contraseña',
    showPassword: 'Mostrar contraseña',
    hidePassword: 'Ocultar contraseña',
    signIn: 'Iniciar sesión',
    playAsGuest: 'Jugar como invitado',
    noAccount: '¿No tienes cuenta?',
    createOne: 'Crear una',
    emailRequired: 'El correo es obligatorio',
    emailInvalid: 'Formato de correo inválido',
    passwordRequired: 'La contraseña es obligatoria',
    passwordMinLength: 'La contraseña debe tener al menos 6 caracteres',
    createAccountTitle: 'Crear cuenta',
    createAccountSubtitle: 'Únete a YOVI y empieza a jugar',
    username: 'Nombre de usuario',
    usernamePlaceholder: 'Elige un nombre de usuario',
    usernameRequired: 'El nombre de usuario es obligatorio',
    usernameMinLength: 'El nombre de usuario debe tener al menos 3 caracteres',
    confirmPassword: 'Confirmar contraseña',
    confirmPasswordPlaceholder: 'Confirma tu contraseña',
    passwordsDoNotMatch: 'Las contraseñas no coinciden',
    createAccount: 'Crear cuenta',
    alreadyHaveAccount: '¿Ya tienes cuenta?',
    signInLink: 'Inicia sesión',
    accountCreatedTitle: '¡Cuenta creada!',
    accountCreatedDescription: 'Tu cuenta se ha creado correctamente. Ya puedes empezar a jugar.',
    startPlaying: 'Empezar a jugar',
  },

  // ── Game Selection ────────────────────────────────────────────────────────────
  gameSelection: {
    title: 'Elige tu juego',
    subtitle: 'Selecciona un juego para empezar',
    availableGames: 'Juegos disponibles',
    players: '{{count}} jugadores',
    playersRange: '{{min}}-{{max}} jugadores',
    playNow: 'Jugar ahora',
    comingSoon: 'Próximamente',
    selectGame: 'Selecciona un juego de la lista',
  },

  // ── Game Modes ────────────────────────────────────────────────────────────────
  gameModes: {
    title: 'Game Y',
    subtitle: 'Selecciona cómo quieres jugar',
    backToGames: 'Volver a juegos',
    pvpLocal: {
      title: 'Partida local',
      description: 'Juega contra un amigo en el mismo dispositivo. Turnos alternos.',
    },
    pvpOnline: {
      title: 'Partida online',
      description: 'Desafía a jugadores de todo el mundo en partidas en tiempo real.',
    },
    pve: {
      title: 'Contra el ordenador',
      description: 'Practica contra una IA a distintos niveles de dificultad.',
    },
    soon: 'Pronto',
  },

  // ── Game Config ───────────────────────────────────────────────────────────────
  gameConfig: {
    localMatch: 'Partida local',
    vsComputer: 'Contra el ordenador',
    gameSetup: 'Configuración',
    configureSettings: 'Configura los ajustes de la partida',
    boardSize: 'Tamaño del tablero',
    boardSizeRange: 'Introduce un número de {{min}} a {{max}}. Los tableros más grandes dan partidas más largas y estratégicas.',
    boardSizeError: 'Debe ser un número entero entre {{min}} y {{max}}',
    boardSizeErrorFull: 'El tamaño del tablero debe ser un entero entre {{min}} y {{max}}',
    boardSizeDisplay: '{{size}} × {{size}}',
    boardSizePlaceholder: '— × —',
    botDifficulty: 'Dificultad del bot',
    yourColor: 'Tu color',
    colorBlue: 'Azul (Primero)',
    colorRed: 'Rojo (Segundo)',
    enableTimer: 'Activar temporizador',
    timerDescription: 'Cada jugador tiene tiempo limitado para jugar',
    timePerPlayer: 'Tiempo por jugador',
    timerRange: 'Introduce un número de {{min}} a {{max}} minutos.',
    timerError: 'Debe ser un número entero entre {{min}} y {{max}}',
    timerErrorFull: 'El temporizador debe ser un entero entre {{min}} y {{max}} minutos',
    pieRule: 'Regla del pastel',
    pieRuleDescription: 'Tras el primer movimiento, el segundo jugador puede cambiar de bando',
    startGame: 'Iniciar partida',
    botLevels: {
      easy: 'Fácil',
      medium: 'Intermedio',
      hard: 'Difícil',
    },
  },

  // ── Game Play ─────────────────────────────────────────────────────────────────
  game: {
    loadingGame: 'Cargando partida...',
    gameNotFound: 'Partida no encontrada',
    gameY: 'Game Y',
    moves: 'Movimientos: {{count}}',
    surrender: 'Rendirse',
    playAgain: 'Jugar de nuevo',
    backToGames: 'Volver a juegos',
    turn: 'Turno de {{name}}',
    wins: '¡{{name}} gana!',
    gameOver: 'Fin de la partida',
    collapseSidebar: 'Contraer panel',
    expandSidebar: 'Expandir panel',
    pieRule: 'Regla del pastel',
    pieDeciding: '{{name}} decide si cambiar…',
    piePrompt: '— ¿mantener tu lado o tomar la primera piedra?',
    keep: 'Mantener',
    swap: 'Cambiar',
  },

  // ── Chat ──────────────────────────────────────────────────────────────────────
  chat: {
    title: 'Chat',
    noMessages: 'Sin mensajes aún',
    placeholder: 'Escribe un mensaje...',
    you: 'Tú',
  },

  // ── Game Overlay ──────────────────────────────────────────────────────────────
  overlay: {
    victory: 'VICTORIA',
    defeat: 'DERROTA',
    draw: 'EMPATE',
    youBeat: 'Ganaste a ',
    beatenBy: 'Perdiste contra ',
    winsLocal: '¡{{name}} gana!',
    movesStat: 'Movimientos',
    boardStat: 'Tablero',
    modeStat: 'Modo',
    modeVsBot: 'VS BOT',
    modeLocal: 'LOCAL',
    modeOnline: 'ONLINE',
    playAgain: 'Jugar de nuevo',
    backToGames: 'Volver a juegos',
    closeViewBoard: 'Cerrar y ver tablero',
  },

  // ── Stats ─────────────────────────────────────────────────────────────────────
  stats: {
    title: 'Estadísticas',
    winrate: 'Porcentaje de victorias',
    overall: 'Global',
    recent: 'Últimas 20 partidas',
    matchHistory: 'Historial de partidas',
    noMatches: 'Aún no has jugado ninguna partida',
    noMatchesFilter: 'Ninguna partida coincide con los filtros seleccionados',
    opponent: 'Oponente',
    result: 'Resultado',
    duration: 'Duración',
    date: 'Fecha',
    gameMode: 'Modo',
    win: 'Victoria',
    loss: 'Derrota',
    noData: 'Sin datos',
    winsLabel: 'Victorias {{count}}',
    lossesLabel: 'Derrotas {{count}}',
    filterAll: 'Todas',
    filterAllModes: 'Todos los modos',
    // Pagination
    first: 'Primera',
    previous: 'Anterior',
    next: 'Siguiente',
    last: 'Última',
    pageOf: '{{page}} / {{total}}',
    trackProgress: 'Sigue tu progreso',
    trackProgressDescription: 'Crea una cuenta gratuita para guardar tu historial y ver tu porcentaje de victorias.',
    createAccount: 'Crear cuenta',
    signIn: 'Iniciar sesión',
  },

  // ── Ranking ───────────────────────────────────────────────────────────────────
  ranking: {
    title: 'Clasificación',
    top5: '{{mode}} — Top 5',
    noData: 'No hay datos disponibles',
    rankHash: '#',
    player: 'Jugador',
    victories: 'Victorias',
    you: '(tú)',
    modes: {
      'pve-easy': 'Bot fácil',
      'pve-medium': 'Bot intermedio',
      'pve-hard': 'Bot difícil',
    },
  },

  // ── Game History ──────────────────────────────────────────────────────────────
  history: {
    title: 'Historial de partidas',
    tableTitle: 'Todas las partidas',
    noGames: 'Aún no has jugado ninguna partida.',
    watchReplay: 'Repetición',
    moves: '{{count}} movimientos',
    colDate: 'Fecha',
    colMode: 'Modo',
    colOpponent: 'Oponente',
    colBoard: 'Tablero',
    colMoves: 'Jugadas',
    colResult: 'Resultado',
    resume: 'Reanudar',
    result: {
      win: 'Victoria',
      loss: 'Derrota',
      draw: 'Empate',
      active: 'En curso',
    },
    mode: {
      pve: 'vs Bot',
      'pvp-local': 'Local',
      'pvp-online': 'Online',
    },
  },

  // ── Replay ────────────────────────────────────────────────────────────────────
  replay: {
    emptyBoard: 'Posición inicial',
    played: 'jugó en ({{row}}, {{col}})',
    stepOf: '{{step}} / {{total}}',
    start: 'Inicio',
    end: 'Final',
    goToStart: 'Ir al inicio',
    previousMove: 'Jugada anterior',
    nextMove: 'Jugada siguiente',
    goToEnd: 'Ir al final',
    scrubber: 'Control de jugadas',
    keyboardHint: 'Teclas ← → para avanzar jugada a jugada',
  },

  // ── 404 ───────────────────────────────────────────────────────────────────────
  notFound: {
    heading: '404',
    message: 'Página no encontrada',
    backToGames: 'Volver a juegos',
  },

  // ── Language switcher ─────────────────────────────────────────────────────────
  language: {
    switchTo: 'English',
    ariaLabel: 'Cambiar idioma',
  },
} as const

export default es