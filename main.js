// ============================================
// 1. ИНИЦИАЛИЗАЦИЯ VK MINI APP
// ============================================
vkBridge.send("VKWebAppInit", {});

// Безопасная инициализация плеера — VK.VideoPlayer может быть ещё не готов
let player = null;
try {
  const iframe = document.getElementById('vkVideo');
  if (typeof VK !== 'undefined' && VK.VideoPlayer) {
    // player = VK.VideoPlayer(iframe);
  } else {
    console.warn('VK.VideoPlayer не загружен. Проверьте подключение videoplayer.js');
  }
} catch (e) {
  console.warn('Не удалось создать плеер:', e);
}

// ============================================
// 2. РЕЖИМЫ РАБОТЫ
// ============================================
const MODE_TEXT = 'text';    // Листаем текстовый рецепт
const MODE_VIDEO = 'video';  // Перематываем видео

let currentMode = MODE_TEXT;

// ============================================
// 3. ДАННЫЕ РЕЦЕПТА
// ============================================
const recipe = {
  steps: [
    'Шаг 1: Вскипятите воду в кастрюле.',
    'Шаг 2: Добавьте макароны и варите 10 минут.',
    'Шаг 3: Слейте воду через дуршлаг.',
    'Шаг 4: Добавьте соус и перемешайте.',
    'Шаг 5: Подавайте горячим, посыпав сыром.'
  ],
  ingredients: ['Макароны 200 г', 'Вода 2 л', 'Соус томатный 150 г', 'Сыр пармезан 50 г']
};

// Тайм-коды для видео (в миллисекундах) — задайте вручную
const timestamps = [
  0,        // Шаг 1
  15000,    // Шаг 2
  45000,    // Шаг 3
  78000,    // Шаг 4
  120000    // Шаг 5
];

let currentStepIndex = 0;

// ============================================
// 4. DOM-ЭЛЕМЕНТЫ
// ============================================
const stepDisplay = document.getElementById('recipe-step');
const micButton = document.getElementById('mic-button');
const statusDisplay = document.getElementById('status');
const modeDisplay = document.getElementById('mode-display'); // опционально

// ============================================
// 5. ОТОБРАЖЕНИЕ
// ============================================
function updateDisplay() {
  stepDisplay.textContent = recipe.steps[currentStepIndex];
  statusDisplay.textContent =
    `Шаг ${currentStepIndex + 1} из ${recipe.steps.length} | Режим: ${currentMode === MODE_TEXT ? '📖 Текст' : '🎬 Видео'}`;
}

// ============================================
// 6. ПЕРЕКЛЮЧЕНИЕ ШАГА (единая точка входа)
// ============================================
function changeStep(newIndex) {
  if (newIndex < 0 || newIndex >= recipe.steps.length) {
    speak(newIndex < 0 ? 'Это первый шаг.' : 'Это последний шаг.');
    return;
  }
  
  currentStepIndex = newIndex;
  
  // В видеорежиме — перематываем видео
  if (currentMode === MODE_VIDEO && player && timestamps[currentStepIndex] !== undefined) {
    try {
      player.seekTo(timestamps[currentStepIndex]);
    } catch (e) {
      console.warn('Не удалось перемотать видео:', e);
    }
  }
  
  updateDisplay();
  speak(recipe.steps[currentStepIndex]);
}

function goToNextStep() {
  changeStep(currentStepIndex + 1);
}

function goToPrevStep() {
  changeStep(currentStepIndex - 1);
}

// ============================================
// 7. ПЕРЕКЛЮЧЕНИЕ РЕЖИМОВ
// ============================================
function switchMode(mode) {
  currentMode = mode;
  updateDisplay();
  
  if (mode === MODE_VIDEO) {
    speak('Режим видео. Команды дальше и назад перематывают видео.');
  } else {
    speak('Текстовый режим.');
  }
}

// ============================================
// 8. ОЗВУЧИВАНИЕ (TTS)
// ============================================
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ru-RU';
  utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}

// ============================================
// 9. РАСПОЗНАВАНИЕ РЕЧИ
// ============================================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let isListening = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'ru-RU';
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  
  recognition.onresult = (event) => {
    const lastIndex = event.results.length - 1;
    const transcript = event.results[lastIndex][0].transcript.toLowerCase().trim();
    
    console.log('Распознано:', transcript);
    statusDisplay.textContent = `Услышано: "${transcript}"`;
    
    handleCommandLocally(transcript);
  };
  
  recognition.onerror = (event) => {
    console.warn('Ошибка распознавания:', event.error);
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      statusDisplay.textContent = `Ошибка: ${event.error}`;
    }
  };
  
  recognition.onend = () => {
    if (isListening) {
      try {
        recognition.start();
      } catch (e) {
        console.warn('Не удалось перезапустить:', e);
      }
    }
  };
} else {
  statusDisplay.textContent = 'Браузер не поддерживает распознавание речи.';
  micButton.disabled = true;
}

// ============================================
// 10. ОБРАБОТКА ГОЛОСОВЫХ КОМАНД
// ============================================
function handleCommandLocally(text) {
  // --- Переключение режимов ---
  if (text.includes('видео') || text.includes('включи видео')) {
    switchMode(MODE_VIDEO);
    return;
  }
  
  if (text.includes('текст') || text.includes('текстовый режим')) {
    switchMode(MODE_TEXT);
    return;
  }
  
  // --- Навигация (работает в обоих режимах) ---
  if (
    text.includes('дальше') ||
    text.includes('следующий') ||
    text.includes('вперёд') ||
    text.includes('вперед')
  ) {
    goToNextStep();
    return;
  }
  
  if (
    text.includes('назад') ||
    text.includes('предыдущий') ||
    text.includes('вернись')
  ) {
    goToPrevStep();
    return;
  }
  
  // --- Ингредиенты ---
  if (text.includes('ингредиент') || text.includes('состав')) {
    const list = 'Ингредиенты: ' + recipe.ingredients.join(', ');
    speak(list);
    statusDisplay.textContent = list;
    return;
  }
  
  // --- Повтор шага ---
  if (text.includes('повтори') || text.includes('ещё раз') || text.includes('еще раз')) {
    speak(recipe.steps[currentStepIndex]);
    return;
  }
  
  // --- Прочитать шаг ---
  if (text.includes('прочитай') || text.includes('зачитай')) {
    speak(recipe.steps[currentStepIndex]);
  }
}

// ============================================
// 11. УПРАВЛЕНИЕ МИКРОФОНОМ
// ============================================
micButton.addEventListener('click', async () => {
  if (!recognition) return;
  
  if (isListening) {
    isListening = false;
    recognition.stop();
    micButton.textContent = '🎤 Слушать';
    statusDisplay.textContent = 'Прослушивание остановлено';
  } else {
    try {
      await vkBridge.send('VKWebAppTapticImpactOccurred', { style: 'light' });
    } catch (e) {}
    
    isListening = true;
    recognition.start();
    micButton.textContent = '⏹️ Остановить';
    statusDisplay.textContent = 'Слушаю...';
  }
});

// ============================================
// 12. WAKE LOCK (защита от засыпания экрана)
// ============================================
let wakeLock = null;

async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) {
      console.warn('Wake Lock недоступен:', e);
    }
  }
}

micButton.addEventListener('click', () => {
  if (isListening) requestWakeLock();
});

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && isListening) {
    requestWakeLock();
  }
});

// ============================================
// 13. СТАРТ
// ============================================
updateDisplay();
