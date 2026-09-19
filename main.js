
// ============================================
// 1. ИНИЦИАЛИЗАЦИЯ VK MINI APP
// ============================================
vkBridge.send("VKWebAppInit", {});
// ============================================
// 2. ПРОСТОЙ РЕЦЕПТ (в будущем — из вашей БД)
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

let currentStepIndex = 0;

// DOM-элементы
const stepDisplay = document.getElementById('recipe-step');
const micButton = document.getElementById('mic-button');
const statusDisplay = document.getElementById('status');

// ============================================
// 3. ФУНКЦИЯ ОБНОВЛЕНИЯ ЭКРАНА
// ============================================
function updateDisplay() {
  stepDisplay.textContent = recipe.steps[currentStepIndex];
  statusDisplay.textContent = `Шаг ${currentStepIndex + 1} из ${recipe.steps.length}`;
}

function goToNextStep() {
  if (currentStepIndex < recipe.steps.length - 1) {
    currentStepIndex++;
    updateDisplay();
    speak(recipe.steps[currentStepIndex]); // Озвучиваем новый шаг
    return true;
  }
  speak('Это последний шаг рецепта.');
  return false;
}

function goToPrevStep() {
  if (currentStepIndex > 0) {
    currentStepIndex--;
    updateDisplay();
    speak(recipe.steps[currentStepIndex]);
    return true;
  }
  speak('Это первый шаг рецепта.');
  return false;
}

// ============================================
// 4. ОЗВУЧИВАНИЕ (TTS через SpeechSynthesis)
// ============================================
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  
  // Прерываем предыдущее воспроизведение, чтобы не было очереди
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ru-RU';
  utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}

// ============================================
// 5. РАСПОЗНАВАНИЕ РЕЧИ (Web Speech API)
// ============================================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let isListening = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'ru-RU';
  recognition.continuous = true;         // Слушаем непрерывно
  recognition.interimResults = false;    // Нас интересуют только финальные фразы
  recognition.maxAlternatives = 1;
  
  // Обработка результата
  recognition.onresult = async (event) => {
    const lastIndex = event.results.length - 1;
    const transcript = event.results[lastIndex][0].transcript
      .toLowerCase()
      .trim();
    
    console.log('Распознано:', transcript);
    statusDisplay.textContent = `Услышано: "${transcript}"`;
    
    // Локальная обработка команды (дублирование серверной логики)
    handleCommandLocally(transcript);
  };
  
  recognition.onerror = (event) => {
    console.warn('Ошибка распознавания:', event.error);
    // Игнорируем «тишину», чтобы не спамить пользователя
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      statusDisplay.textContent = `Ошибка: ${event.error}`;
    }
  };
  
  // ВАЖНО: авто-перезапуск, так как браузер сам останавливает сессию
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
  statusDisplay.textContent = 'Ваш браузер не поддерживает распознавание речи.';
  micButton.disabled = true;
}

// Получаем ID пользователя через VK Bridge
async function getUserId() {
  try {
    const userInfo = await bridge.send('VKWebAppGetUserInfo');
    return userInfo.id;
  } catch (e) {
    console.warn('Не удалось получить ID пользователя:', e);
    return null;
  }
}

// ============================================
// 7. ЛОКАЛЬНАЯ ОБРАБОТКА КОМАНД
// ============================================
function handleCommandLocally(text) {
  // Команды «вперёд»
  if (
    text.includes('дальше') ||
    text.includes('следующий') ||
    text.includes('вперёд') ||
    text.includes('вперед')
  ) {
    goToNextStep();
    return;
  }
  
  // Команды «назад»
  if (
    text.includes('назад') ||
    text.includes('предыдущий') ||
    text.includes('вернись')
  ) {
    goToPrevStep();
    return;
  }
  
  // Озвучивание ингредиентов
  if (text.includes('ингредиент') || text.includes('состав')) {
    const list = 'Ингредиенты: ' + recipe.ingredients.join(', ');
    speak(list);
    statusDisplay.textContent = list;
    return;
  }
  
  // Повторить текущий шаг
  if (text.includes('повтори') || text.includes('ещё раз') || text.includes('еще раз')) {
    speak(recipe.steps[currentStepIndex]);
    return;
  }
  
  // Озвучивание текущего шага по запросу
  if (text.includes('прочитай') || text.includes('зачитай')) {
    speak(recipe.steps[currentStepIndex]);
  }
}

// ============================================
// 8. УПРАВЛЕНИЕ КНОПКОЙ МИКРОФОНА
// ============================================
micButton.addEventListener('click', async () => {
  if (!recognition) return;
  
  if (isListening) {
    // Останавливаем
    isListening = false;
    recognition.stop();
    micButton.textContent = '🎤 Слушать';
    statusDisplay.textContent = 'Прослушивание остановлено';
  } else {
    // Запускаем
    // Небольшая тактильная отдача через VK Bridge (опционально)
    try {
      await bridge.send('VKWebAppTapticImpactOccurred', { style: 'light' });
    } catch (e) {}
    
    isListening = true;
    recognition.start();
    micButton.textContent = '⏹️ Остановить';
    statusDisplay.textContent = 'Слушаю...';
  }
});

// ============================================
// 9. ЗАЩИТА ОТ ЗАСЫПАНИЯ ЭКРАНА (мобильные)
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

// Запрашиваем Wake Lock, когда начинаем слушать
micButton.addEventListener('click', () => {
  if (isListening) requestWakeLock();
});

// Освобождаем при сворачивании страницы
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && isListening) {
    requestWakeLock();
  }
});

// ============================================
// 10. СТАРТОВАЯ ИНИЦИАЛИЗАЦИЯ
// ============================================
updateDisplay();
