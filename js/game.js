// ══════════════════════════════════════════════
//  ESTADO GLOBAL
// ══════════════════════════════════════════════
const STATE = {
  player: null,        // 'lucia' | 'gabo'
  operation: null,     // 'suma'|'resta'|'multiplicacion'|'division'
  timeLimit: null,     // segundos
  timeLeft: 0,
  timerInterval: null,
  score: 0,
  correct: 0,
  wrong: 0,
  streak: 0,
  bestStreak: 0,
  difficulty: 1,       // 1–5
  questionCount: 0,    // preguntas respondidas en dificultad actual
  currentOp: null,     // { a, b, answer, symbol }
  pendingRetry: false, // true si la pregunta actual debe repetirse
  avatars: {
    lucia: null,
    gabo: null
  }
};

// Puntos por dificultad
const POINTS = [0, 1, 2, 3, 5, 8];

// Emojis por jugador
const PLAYER_CONFIG = {
  lucia: { emoji: '🌸', theme: 'theme-lucia' },
  gabo:  { emoji: '⚽', theme: 'theme-gabo' }
};

// Nombres de dificultad
const DIFFICULTY_NAMES = ['', 'Nivel 1 🌱', 'Nivel 2 ⭐', 'Nivel 3 🔥', 'Nivel 4 💎', 'Nivel 5 🚀'];

// ══════════════════════════════════════════════
//  NAVEGACIÓN
// ══════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  target.classList.add('active');
}

function goBack(screenId) {
  if (STATE.timerInterval) {
    clearInterval(STATE.timerInterval);
    STATE.timerInterval = null;
  }
  showScreen(screenId);
}

// ══════════════════════════════════════════════
//  SELECCIÓN DE JUGADOR
// ══════════════════════════════════════════════
function selectPlayer(player) {
  STATE.player = player;
  STATE.operation = null;
  STATE.timeLimit = null;

  // Aplicar tema
  document.body.className = PLAYER_CONFIG[player].theme;

  // Actualizar pantalla setup
  const cfg = PLAYER_CONFIG[player];
  const name = player === 'lucia' ? 'Lucía' : 'Gabo';

  document.getElementById('setup-name').textContent = name;
  document.getElementById('setup-emoji').textContent = STATE.avatars[player] ? '' : cfg.emoji;
  document.getElementById('setup-emoji').style.display = STATE.avatars[player] ? 'none' : '';

  const setupImg = document.getElementById('setup-avatar');
  if (STATE.avatars[player]) {
    setupImg.src = STATE.avatars[player];
    setupImg.classList.remove('hidden');
  } else {
    setupImg.classList.add('hidden');
  }

  // Limpiar selecciones anteriores
  document.querySelectorAll('.op-btn, .time-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('start-btn').classList.add('disabled');

  showScreen('screen-setup');
}

// ══════════════════════════════════════════════
//  CARGA DE AVATAR
// ══════════════════════════════════════════════
function uploadAvatar(player, input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const src = e.target.result;
    STATE.avatars[player] = src;

    // Mostrar en tarjeta de selección
    const img = document.getElementById(`${player}-img`);
    img.src = src;
    img.classList.remove('hidden');
    document.querySelector(`#${player}-avatar .avatar-placeholder`).style.display = 'none';

    // Si es el jugador actual, actualizar setup también
    if (STATE.player === player) {
      const setupImg = document.getElementById('setup-avatar');
      setupImg.src = src;
      setupImg.classList.remove('hidden');
      document.getElementById('setup-emoji').style.display = 'none';
    }
  };
  reader.readAsDataURL(file);
}

// ══════════════════════════════════════════════
//  SELECCIÓN DE OPERACIÓN Y TIEMPO
// ══════════════════════════════════════════════
function selectOperation(op) {
  STATE.operation = op;
  document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('selected'));
  document.querySelector(`.op-btn[data-op="${op}"]`).classList.add('selected');
  checkCanStart();
}

function selectTime(seconds) {
  STATE.timeLimit = seconds;
  document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
  document.querySelector(`.time-btn[data-time="${seconds}"]`).classList.add('selected');
  checkCanStart();
}

function checkCanStart() {
  const btn = document.getElementById('start-btn');
  if (STATE.operation && STATE.timeLimit) {
    btn.classList.remove('disabled');
  } else {
    btn.classList.add('disabled');
  }
}

// ══════════════════════════════════════════════
//  INICIO DEL JUEGO
// ══════════════════════════════════════════════
function startGame() {
  if (!STATE.operation || !STATE.timeLimit) return;

  // Reset estado
  STATE.score = 0;
  STATE.correct = 0;
  STATE.wrong = 0;
  STATE.streak = 0;
  STATE.bestStreak = 0;
  STATE.difficulty = 1;
  STATE.pendingRetry = false;
  STATE.timeLeft = STATE.timeLimit;

  // Configurar HUD
  const player = STATE.player;
  const cfg = PLAYER_CONFIG[player];
  const name = player === 'lucia' ? 'Lucía' : 'Gabo';

  document.getElementById('game-name').textContent = name;
  document.getElementById('game-emoji').textContent = STATE.avatars[player] ? '' : cfg.emoji;
  document.getElementById('game-emoji').style.display = STATE.avatars[player] ? 'none' : '';

  const gameImg = document.getElementById('game-avatar');
  if (STATE.avatars[player]) {
    gameImg.src = STATE.avatars[player];
    gameImg.classList.remove('hidden');
  } else {
    gameImg.classList.add('hidden');
  }

  updateHUD();
  generateQuestion();
  showScreen('screen-game');
  document.getElementById('answer-input').focus();

  // Iniciar timer
  STATE.timerInterval = setInterval(tickTimer, 1000);
}

// ══════════════════════════════════════════════
//  GENERADOR DE PREGUNTAS
// ══════════════════════════════════════════════
function generateQuestion() {
  // Si el modo es "todas", elegir operación al azar en cada pregunta
  const ALL_OPS = ['suma', 'resta', 'multiplicacion', 'division'];
  const op = STATE.operation === 'todas'
    ? ALL_OPS[Math.floor(Math.random() * ALL_OPS.length)]
    : STATE.operation;

  STATE.currentOpType = op; // guardar cuál tocó esta vez
  const d  = STATE.difficulty;
  let a, b, answer, symbol;

  // Rangos por dificultad
  const ranges = {
    1: [1, 9],
    2: [2, 20],
    3: [5, 50],
    4: [10, 100],
    5: [20, 200]
  };

  const [min, max] = ranges[d];

  switch (op) {
    case 'suma':
      a = randInt(min, max);
      b = randInt(min, max);
      answer = a + b;
      symbol = '+';
      break;

    case 'resta':
      // Siempre resultado positivo
      a = randInt(min, max);
      b = randInt(min, a);
      answer = a - b;
      symbol = '−';
      break;

    case 'multiplicacion': {
      // Nivel 1: una cifra × una cifra | Nivel 2: ×12 | 3: ×15 | 4: ×20 | 5: ×30
      const multMax = d === 1 ? 9 : d === 2 ? 12 : d === 3 ? 15 : d === 4 ? 20 : 30;
      a = randInt(1, multMax);
      b = randInt(1, multMax);
      answer = a * b;
      symbol = '×';
      break;
    }

    case 'division': {
      const divMax = d === 1 ? 9 : d === 2 ? 12 : d === 3 ? 15 : d === 4 ? 20 : 30;
      b = randInt(1, divMax);
      answer = randInt(1, divMax);
      a = b * answer;
      symbol = '÷';
      break;
    }
  }

  STATE.currentOp = { a, b, answer, symbol };

  // Mostrar
  document.getElementById('operation-text').textContent = `${a} ${symbol} ${b} = ?`;
  document.getElementById('difficulty-badge').textContent = DIFFICULTY_NAMES[d];
  document.getElementById('answer-input').value = '';
  document.getElementById('answer-input').classList.remove('shake', 'correct-pulse');
  document.getElementById('answer-input').focus();
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ══════════════════════════════════════════════
//  VERIFICACIÓN DE RESPUESTA
// ══════════════════════════════════════════════
function checkAnswer() {
  const input = document.getElementById('answer-input');
  const val = input.value.trim();
  if (val === '' || isNaN(val)) return;

  const userAnswer = parseInt(val, 10);
  const correct = STATE.currentOp.answer;

  if (userAnswer === correct) {
    handleCorrect();
  } else {
    handleWrong(correct);
  }
}

function handleCorrect() {
  const pts = POINTS[STATE.difficulty];
  STATE.score += pts;
  STATE.correct++;
  STATE.streak++;
  STATE.bestStreak = Math.max(STATE.bestStreak, STATE.streak);
  STATE.questionCount++;

  // +3 segundos al timer
  STATE.timeLeft += 3;

  // Feedback visual
  showFeedback(`+${pts} ⭐`, true);
  document.getElementById('answer-input').classList.add('correct-pulse');
  setTimeout(() => document.getElementById('answer-input').classList.remove('correct-pulse'), 400);

  // Streak visual
  updateStreak();

  // Actualizar HUD
  updateHUD();

  // Subir dificultad con racha de 20 aciertos seguidos (máximo 5)
  if (STATE.streak > 0 && STATE.streak % 20 === 0 && STATE.difficulty < 5) {
    STATE.difficulty++;
    showFeedback('¡Subiste de nivel! 🎉', true);
    launchConfetti(6);
  }

  STATE.pendingRetry = false;
  setTimeout(generateQuestion, 300);
}

function handleWrong(correctAnswer) {
  STATE.wrong++;
  STATE.streak = 0;

  // Mostrar respuesta correcta brevemente
  const flash = document.getElementById('correct-flash');
  document.getElementById('correct-answer-text').textContent = `La respuesta es ${correctAnswer}`;
  flash.classList.add('show');

  // Animación de error
  document.getElementById('answer-input').classList.add('shake');
  setTimeout(() => document.getElementById('answer-input').classList.remove('shake'), 400);

  showFeedback('❌ ¡Inténtalo otra vez!', false);
  updateStreak();
  updateHUD();

  // Ocultar flash y repetir la misma pregunta
  setTimeout(() => {
    flash.classList.remove('show');
    document.getElementById('answer-input').value = '';
    document.getElementById('answer-input').focus();
  }, 1800);
}

// ══════════════════════════════════════════════
//  TIMER
// ══════════════════════════════════════════════
function tickTimer() {
  STATE.timeLeft--;

  const timerEl = document.getElementById('timer-display');
  const mins = Math.floor(STATE.timeLeft / 60);
  const secs = STATE.timeLeft % 60;
  timerEl.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;

  // Urgencia en los últimos 10 segundos
  if (STATE.timeLeft <= 10) {
    timerEl.classList.add('timer-urgent');
  } else {
    timerEl.classList.remove('timer-urgent');
  }

  if (STATE.timeLeft <= 0) {
    endGame();
  }
}

// ══════════════════════════════════════════════
//  FIN DEL JUEGO
// ══════════════════════════════════════════════
function endGame() {
  clearInterval(STATE.timerInterval);
  STATE.timerInterval = null;

  // Rellenar resultados
  const player = STATE.player;
  const name = player === 'lucia' ? 'Lucía' : 'Gabo';
  const cfg = PLAYER_CONFIG[player];

  document.getElementById('results-name').textContent = `¡Bien jugado, ${name}!`;
  document.getElementById('results-emoji').textContent = STATE.avatars[player] ? '' : cfg.emoji;
  document.getElementById('results-emoji').style.display = STATE.avatars[player] ? 'none' : '';

  const resImg = document.getElementById('results-avatar');
  if (STATE.avatars[player]) {
    resImg.src = STATE.avatars[player];
    resImg.classList.remove('hidden');
  } else {
    resImg.classList.add('hidden');
  }

  document.getElementById('res-score').textContent = STATE.score;
  document.getElementById('res-correct').textContent = STATE.correct;
  document.getElementById('res-wrong').textContent = STATE.wrong;
  document.getElementById('res-streak').textContent = STATE.bestStreak;

  // Mensaje según desempeño
  const acc = STATE.correct + STATE.wrong > 0
    ? Math.round((STATE.correct / (STATE.correct + STATE.wrong)) * 100)
    : 0;

  let msg;
  if (acc >= 90) msg = `¡Perfecto! Acertaste el ${acc}% de las respuestas. ¡Eres increíble! 🏆`;
  else if (acc >= 70) msg = `¡Muy bien! Acertaste el ${acc}%. ¡Sigue practicando! 🌟`;
  else if (acc >= 50) msg = `¡Bien! Acertaste el ${acc}%. ¡Cada vez mejoras más! 💪`;
  else msg = `Acertaste el ${acc}%. ¡La práctica hace al maestro! 🌱`;

  document.getElementById('results-message').textContent = msg;

  showScreen('screen-results');
  saveResult();
  launchConfetti(20);
}

// ══════════════════════════════════════════════
//  PLAY AGAIN
// ══════════════════════════════════════════════
function playAgain() {
  // Mantener jugador, operación y tiempo
  startGame();
}

// ══════════════════════════════════════════════
//  HELPERS UI
// ══════════════════════════════════════════════
function updateHUD() {
  document.getElementById('score-display').textContent = STATE.score;
}

function updateStreak() {
  const el = document.getElementById('streak-display');
  if (STATE.streak >= 3) {
    el.textContent = `🔥 ¡Racha de ${STATE.streak}!`;
  } else if (STATE.streak === 0) {
    el.textContent = '';
  } else {
    el.textContent = '';
  }
}

function showFeedback(text, isCorrect) {
  const el = document.getElementById('feedback-popup');
  el.textContent = text;
  el.className = 'feedback-popup';
  void el.offsetWidth; // reflow para reiniciar animación
  el.classList.add(isCorrect ? 'show-correct' : 'show-wrong');
}

// ══════════════════════════════════════════════
//  CONFETTI
// ══════════════════════════════════════════════
function launchConfetti(count = 15) {
  const colors = STATE.player === 'lucia'
    ? ['#c084fc','#f0abfc','#f9a8d4','#e879f9','#fae8ff']
    : ['#3b82f6','#22c55e','#facc15','#ef4444','#f97316'];

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = `${1.5 + Math.random() * 2}s`;
      piece.style.animationDelay = `${Math.random() * 0.5}s`;
      piece.style.width = `${6 + Math.random() * 10}px`;
      piece.style.height = `${6 + Math.random() * 10}px`;
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 4000);
    }, i * 60);
  }
}

// ══════════════════════════════════════════════
//  HISTORIAL — localStorage
// ══════════════════════════════════════════════
const OP_LABELS = {
  suma: 'Suma ➕',
  resta: 'Resta ➖',
  multiplicacion: 'Multiplicación ✖️',
  division: 'División ➗',
  todas: 'Todas 🎲'
};

function saveResult() {
  const player = STATE.player;
  const key = `mathgame_history_${player}`;
  let history = [];

  try {
    const raw = localStorage.getItem(key);
    if (raw) history = JSON.parse(raw);
  } catch(e) { history = []; }

  const total = STATE.correct + STATE.wrong;
  const acc = total > 0 ? Math.round((STATE.correct / total) * 100) : 0;

  const entry = {
    date: new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'2-digit' }),
    time: new Date().toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' }),
    operation: STATE.operation,
    timeLimit: STATE.timeLimit,
    score: STATE.score,
    correct: STATE.correct,
    wrong: STATE.wrong,
    bestStreak: STATE.bestStreak,
    maxDifficulty: STATE.difficulty,
    accuracy: acc
  };

  history.unshift(entry); // más reciente primero
  if (history.length > 50) history = history.slice(0, 50); // máximo 50 partidas

  try {
    localStorage.setItem(key, JSON.stringify(history));
  } catch(e) { /* sin espacio, ignorar */ }
}

function loadHistory(player) {
  const key = `mathgame_history_${player}`;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function showHistory() {
  const player = STATE.player;
  const name = player === 'lucia' ? 'Lucía' : 'Gabo';
  const cfg = PLAYER_CONFIG[player];
  const history = loadHistory(player);

  // Header
  document.getElementById('history-title').textContent = `Progreso de ${name}`;
  document.getElementById('history-emoji').textContent = STATE.avatars[player] ? '' : cfg.emoji;
  document.getElementById('history-emoji').style.display = STATE.avatars[player] ? 'none' : '';

  const histImg = document.getElementById('history-avatar');
  if (STATE.avatars[player]) {
    histImg.src = STATE.avatars[player];
    histImg.classList.remove('hidden');
  } else {
    histImg.classList.add('hidden');
  }

  // Calcular récords
  const recEl = document.getElementById('history-records');
  if (history.length === 0) {
    recEl.innerHTML = '';
  } else {
    const bestScore  = Math.max(...history.map(h => h.score));
    const totalGames = history.length;
    const avgAcc     = Math.round(history.reduce((s, h) => s + h.accuracy, 0) / history.length);
    const bestStreak = Math.max(...history.map(h => h.bestStreak));

    recEl.innerHTML = `
      <div class="record-card">
        <div class="record-value">🏆 ${bestScore}</div>
        <div class="record-label">Mejor puntaje</div>
      </div>
      <div class="record-card">
        <div class="record-value">🎮 ${totalGames}</div>
        <div class="record-label">Partidas jugadas</div>
      </div>
      <div class="record-card">
        <div class="record-value">🎯 ${avgAcc}%</div>
        <div class="record-label">Precisión promedio</div>
      </div>
      <div class="record-card" style="grid-column:1/-1">
        <div class="record-value">🔥 ${bestStreak}</div>
        <div class="record-label">Mejor racha de aciertos</div>
      </div>
    `;
  }

  // Lista de partidas (ordenadas por puntaje para las medallas, mostradas cronológicamente)
  const listEl = document.getElementById('history-list');
  if (history.length === 0) {
    listEl.innerHTML = `<div class="history-empty">¡Aún no hay partidas guardadas!<br>Juega para ver tu progreso aquí 🌱</div>`;
  } else {
    // Top 3 puntajes para asignar medallas
    const sorted = [...history].sort((a, b) => b.score - a.score);
    const top3 = sorted.slice(0, 3).map(h => h.score);

    listEl.innerHTML = history.map((h, i) => {
      let rankHtml = `<span class="history-row-rank">#${i + 1}</span>`;
      const scoreRank = top3.indexOf(h.score);
      if (scoreRank === 0) rankHtml = `<span class="history-row-rank medal-gold">🥇</span>`;
      else if (scoreRank === 1) rankHtml = `<span class="history-row-rank medal-silver">🥈</span>`;
      else if (scoreRank === 2) rankHtml = `<span class="history-row-rank medal-bronze">🥉</span>`;

      const mins = Math.floor(h.timeLimit / 60);
      return `
        <div class="history-row">
          ${rankHtml}
          <div class="history-row-info">
            <div class="history-row-op">${OP_LABELS[h.operation] || h.operation} · ${mins} min</div>
            <div class="history-row-date">${h.date} ${h.time} · Nivel ${h.maxDifficulty} · Racha ${h.bestStreak}</div>
          </div>
          <div class="history-row-score">${h.score} ⭐</div>
          <div class="history-row-acc">${h.accuracy}%</div>
        </div>
      `;
    }).join('');
  }

  showScreen('screen-history');
}

// ══════════════════════════════════════════════
//  ENTER para confirmar respuesta
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('answer-input');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkAnswer();
  });
});
