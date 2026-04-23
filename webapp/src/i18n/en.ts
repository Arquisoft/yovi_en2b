const en = {
  // ── Common ──────────────────────────────────────────────────────────────────
  common: {
    back: 'Back',
    cancel: 'Cancel',
    loading: 'Loading...',
    error: 'Error',
    save: 'Save',
    confirm: 'Confirm',
    close: 'Close',
    or: 'or',
    minutes: 'minutes',
    minute: 'minute',
  },

  // ── App / Branding ───────────────────────────────────────────────────────────
  app: {
    loading: 'Loading YOVI...',
    name: 'YOVI',
  },

  // ── Navigation ───────────────────────────────────────────────────────────────
  nav: {
    toggleTheme: 'Toggle theme',
    statistics: 'Statistics',
    ranking: 'Ranking',
    logout: 'Logout',
    guestBadge: 'Guest',
    signOut: 'Sign out',
    signOutConfirmTitle: 'Sign out',
    signOutConfirmDescription: 'Are you sure you want to sign out of your account?',
    history: 'Game History',

  },

  // ── Auth ─────────────────────────────────────────────────────────────────────
  auth: {
    welcomeTitle: 'Welcome to YOVI',
    welcomeSubtitle: 'Sign in to your account to continue',
    email: 'Email',
    emailPlaceholder: 'you@example.com',
    password: 'Password',
    passwordPlaceholder: 'Enter your password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    signIn: 'Sign In',
    playAsGuest: 'Play as Guest',
    noAccount: "Don't have an account?",
    createOne: 'Create one',
    emailRequired: 'Email is required',
    emailInvalid: 'Invalid email format',
    passwordRequired: 'Password is required',
    passwordMinLength: 'Password must be at least 6 characters',
    createAccountTitle: 'Create Account',
    createAccountSubtitle: 'Join YOVI and start playing strategic games',
    username: 'Username',
    usernamePlaceholder: 'Choose a username',
    usernameRequired: 'Username is required',
    usernameMinLength: 'Username must be at least 3 characters',
    confirmPassword: 'Confirm Password',
    confirmPasswordPlaceholder: 'Confirm your password',
    passwordsDoNotMatch: 'Passwords do not match',
    createAccount: 'Create Account',
    alreadyHaveAccount: 'Already have an account?',
    signInLink: 'Sign in',
    accountCreatedTitle: 'Account Created!',
    accountCreatedDescription: 'Your account has been created successfully. You can now start playing.',
    startPlaying: 'Start Playing',
  },

  // ── Game Selection ────────────────────────────────────────────────────────────
  gameSelection: {
    title: 'Choose Your Game',
    subtitle: 'Select a game to start playing',
    availableGames: 'Available Games',
    players: '{{count}} players',
    playersRange: '{{min}}-{{max}} players',
    playNow: 'Play Now',
    comingSoon: 'Coming Soon',
    selectGame: 'Select a game from the list',
  },

  // ── Game Modes ────────────────────────────────────────────────────────────────
  gameModes: {
    title: 'Game Y',
    subtitle: 'Select how you want to play',
    backToGames: 'Back to Games',
    pvpLocal: {
      title: 'Local Match',
      description: 'Play against a friend on the same device. Take turns placing stones.',
    },
    pvpOnline: {
      title: 'Online Match',
      description: 'Challenge players from around the world in real-time matches.',
    },
    pve: {
      title: 'vs Computer',
      description: 'Practice your skills against an AI opponent at various difficulty levels.',
    },
    soon: 'Soon',
  },

  // ── Game Config ───────────────────────────────────────────────────────────────
  gameConfig: {
    localMatch: 'Local Match',
    vsComputer: 'vs Computer',
    gameSetup: 'Game Setup',
    configureSettings: 'Configure your game settings',
    boardSize: 'Board Size',
    boardSizeRange: 'Enter a number from {{min}} to {{max}}. Larger boards make for longer, more strategic games.',
    boardSizeError: 'Must be a whole number between {{min}} and {{max}}',
    boardSizeErrorFull: 'Board size must be a whole number between {{min}} and {{max}}',
    boardSizeDisplay: '{{size}} × {{size}}',
    boardSizePlaceholder: '— × —',
    botDifficulty: 'Bot Difficulty',
    yourColor: 'Your Color',
    colorBlue: 'Blue (First)',
    colorRed: 'Red (Second)',
    enableTimer: 'Enable Timer',
    timerDescription: 'Each player has limited time to play',
    timePerPlayer: 'Time per Player',
    timerRange: 'Enter a number from {{min}} to {{max}} minutes.',
    timerError: 'Must be a whole number between {{min}} and {{max}}',
    timerErrorFull: 'Timer must be a whole number between {{min}} and {{max}} minutes',
    pieRule: 'Pie Rule',
    pieRuleDescription: 'After the first move, the second player may swap sides',
    startGame: 'Start Game',
    botLevels: {
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Hard',
    },
  },

  // ── Game Play ─────────────────────────────────────────────────────────────────
  game: {
    loadingGame: 'Loading game...',
    gameNotFound: 'Game not found',
    gameY: 'Game Y',
    moves: 'Moves: {{count}}',
    surrender: 'Surrender',
    playAgain: 'Play Again',
    backToGames: 'Back to Games',
    turn: "{{name}}'s turn",
    wins: '{{name}} wins!',
    gameOver: 'Game Over',
    collapseSidebar: 'Collapse sidebar',
    expandSidebar: 'Expand sidebar',
    pieRule: 'Pie Rule',
    pieDeciding: '{{name}} is deciding whether to swap…',
    piePrompt: '— keep your side or take the first stone?',
    keep: 'Keep',
    swap: 'Swap',
  },

  // ── Chat ──────────────────────────────────────────────────────────────────────
  chat: {
    title: 'Chat',
    noMessages: 'No messages yet',
    placeholder: 'Type a message...',
    you: 'You',
  },

  // ── Game Overlay ──────────────────────────────────────────────────────────────
  overlay: {
    victory: 'VICTORY',
    defeat: 'DEFEAT',
    draw: 'DRAW',
    youBeat: 'You beat ',
    beatenBy: 'Beaten by ',
    winsLocal: '{{name}} wins!',
    movesStat: 'Moves',
    boardStat: 'Board',
    modeStat: 'Mode',
    modeVsBot: 'VS BOT',
    modeLocal: 'LOCAL',
    modeOnline: 'ONLINE',
    playAgain: 'Play Again',
    backToGames: 'Back to Games',
    closeViewBoard: 'Close and view board',
  },

  // ── Stats ─────────────────────────────────────────────────────────────────────
  stats: {
    title: 'Statistics',
    winrate: 'Winrate',
    overall: 'Overall',
    recent: 'Last 20 games',
    matchHistory: 'Match History',
    noMatches: 'No matches played yet',
    noMatchesFilter: 'No matches match the selected filters',
    opponent: 'Opponent',
    result: 'Result',
    duration: 'Duration',
    date: 'Date',
    gameMode: 'Mode',
    win: 'Win',
    loss: 'Loss',
    noData: 'No data',
    winsLabel: 'Wins {{count}}',
    lossesLabel: 'Losses {{count}}',
    filterAll: 'All',
    filterAllModes: 'All modes',
    // Pagination
    first: 'First',
    previous: 'Previous',
    next: 'Next',
    last: 'Last',
    pageOf: '{{page}} / {{total}}',
    // Guest upsell
    trackProgress: 'Track Your Progress',
    trackProgressDescription: 'Create a free account to save your match history and see your winrate over time.',
    createAccount: 'Create Account',
    signIn: 'Sign In',
  },

  // ── Ranking ───────────────────────────────────────────────────────────────────
  ranking: {
    title: 'Ranking',
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
    title: 'Game History',
    tableTitle: 'All Games',
    noGames: 'No games played yet.',
    watchReplay: 'Replay',
    moves: '{{count}} moves',
    colDate: 'Date',
    colMode: 'Mode',
    colOpponent: 'Opponent',
    colBoard: 'Board',
    colMoves: 'Moves',
    colResult: 'Result',
    resume: 'Resume',
    result: {
      win: 'Win',
      loss: 'Loss',
      draw: 'Draw',
      active: 'In progress',
    },
    mode: {
      pve: 'vs Bot',
      'pvp-local': 'Local',
      'pvp-online': 'Online',
    },
  },
 
  // ── Replay ────────────────────────────────────────────────────────────────────
  replay: {
    emptyBoard: 'Start position',
    played: 'played at ({{row}}, {{col}})',
    stepOf: '{{step}} / {{total}}',
    start: 'Start',
    end: 'End',
    goToStart: 'Go to start',
    previousMove: 'Previous move',
    nextMove: 'Next move',
    goToEnd: 'Go to end',
    scrubber: 'Move scrubber',
    keyboardHint: '← → arrow keys to step through moves',
  },
  // ── 404 ───────────────────────────────────────────────────────────────────────
  notFound: {
    heading: '404',
    message: 'Page not found',
    backToGames: 'Back to Games',
  },

  // ── Language switcher ─────────────────────────────────────────────────────────
  language: {
    switchTo: 'Español',
    ariaLabel: 'Switch language',
  },
} as const

export default en
export type TranslationKeys = typeof en