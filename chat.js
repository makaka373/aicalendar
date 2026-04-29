const KEY_STORAGE = 'gemini_api_key';

function injectKeyInput() {
  const label = document.querySelector('.chat-label');
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;gap:8px;padding:0 20px 10px;';
  wrapper.innerHTML = `
    <input id="api-key-in" type="password" placeholder="Вставьте Gemini API ключ..."
      style="flex:1;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius-sm);
             color:var(--text);padding:6px 10px;font-size:12px;font-family:'Outfit',sans-serif;outline:none;" />
    <button id="api-key-save"
      style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius-sm);
             color:var(--accent);font-size:12px;padding:6px 10px;cursor:pointer;white-space:nowrap;">
      Сохранить
    </button>
  `;
  label.after(wrapper);

  const inp = document.getElementById('api-key-in');
  const saved = localStorage.getItem(KEY_STORAGE);
  if (saved) inp.value = saved;

  document.getElementById('api-key-save').onclick = () => {
    const val = inp.value.trim();
    if (!val) return;
    localStorage.setItem(KEY_STORAGE, val);
    inp.style.borderColor = 'rgba(200,169,126,0.5)';
    setTimeout(() => inp.style.borderColor = '', 1200);
  };
}

function getApiKey() {
  return document.getElementById('api-key-in')?.value.trim()
    || localStorage.getItem(KEY_STORAGE)
    || '';
}

function getEventsContext() {
  const entries = Object.entries(window.events).filter(([, v]) => v.length);
  if (!entries.length) return 'Календарь пуст.';
  return 'События:\n' + entries.sort().map(([k, v]) => `${k}: ${v.join(', ')}`).join('\n');
}

function getTodayKey() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}

function appendBubble(text, role, loading = false) {
  const msgs = document.getElementById('chat-msgs');
  const el = document.createElement('div');
  el.className = `bubble ${role}` + (loading ? ' loading' : '');
  el.textContent = text;
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
  return el;
}

async function callAI(system, userMsg) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NO_KEY');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }]
      })
    }
  );

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function parseText() {
  const textarea = document.getElementById('parse-input');
  const text = textarea.value.trim();
  if (!text) return;

  if (!getApiKey()) { appendBubble('Сначала введите API ключ.', 'ai'); return; }

  const btn = document.getElementById('btn-analyze');
  btn.disabled = true;
  btn.textContent = 'Анализирую...';

  const loader = appendBubble('Анализирую текст...', 'ai', true);
  const today = new Date();

  const system = `Ты — помощник-планировщик. Извлекай события из текста и возвращай ТОЛЬКО валидный JSON без пояснений.
Формат ответа: {"events": [{"date": "YYYY-MM-DD", "title": "название события"}], "summary": "краткое описание что нашёл"}
Сегодня: ${today.toISOString().split('T')[0]}. Год по умолчанию: ${today.getFullYear()}.
Если дата неточная ("в пятницу", "завтра") — вычисли конкретную дату. Если событие без даты — пропусти его.`;

  try {
    const raw = await callAI(system, text);
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    parsed.events.forEach(({ date, title }) => {
      if (!date || !title) return;
      if (!window.events[date]) window.events[date] = [];
      window.events[date].push(title);
    });

    renderAll();
    textarea.value = '';

    loader.className = 'bubble ai';
    loader.textContent = parsed.events.length === 0
      ? 'Событий с датами не найдено.'
      : parsed.summary || `Добавлено событий: ${parsed.events.length}`;
  } catch (e) {
    loader.className = 'bubble ai';
    loader.textContent = e.message === 'NO_KEY' ? 'Введите API ключ.' : 'Не удалось разобрать текст.';
  }

  btn.disabled = false;
  btn.textContent = 'Найти события';
}

async function planDay() {
  if (!getApiKey()) { appendBubble('Сначала введите API ключ.', 'ai'); return; }

  const todayKey = getTodayKey();
  const todayEvents = window.events[todayKey] || [];
  const loader = appendBubble('Планирую ваш день...', 'ai', true);

  const today = new Date();
  const weekday = today.toLocaleDateString('ru-RU', { weekday: 'long' });

  const system = `Ты — умный ассистент-планировщик. Составляй чёткий, реалистичный план дня.
Отвечай только на русском. Указывай временные блоки (09:00–10:00 и т.д.).
После плана добавь новые события строго в таком формате:
EVENTS_JSON:{"events":[{"date":"YYYY-MM-DD","title":"HH:MM Название"}]}
Если добавлять нечего — напиши EVENTS_JSON:{"events":[]}`;

  const userMsg = `Сегодня ${weekday}, ${todayKey}.
Уже запланировано на сегодня: ${todayEvents.length ? todayEvents.join(', ') : 'ничего'}.
Весь календарь: ${getEventsContext()}
Составь продуктивный план дня с временными блоками и добавь их как события.`;

  try {
    const raw = await callAI(system, userMsg);
    const jsonMatch = raw.match(/EVENTS_JSON:(\{.*\})/s);
    const planText = raw.replace(/EVENTS_JSON:\{.*\}/s, '').trim();

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      parsed.events.forEach(({ date, title }) => {
        if (!date || !title) return;
        if (!window.events[date]) window.events[date] = [];
        window.events[date].push(title);
      });
      renderAll();
    }

    loader.className = 'bubble ai';
    loader.textContent = planText || 'План составлен.';
  } catch (e) {
    loader.className = 'bubble ai';
    loader.textContent = e.message === 'NO_KEY' ? 'Введите API ключ.' : 'Ошибка при планировании.';
  }
}

async function sendChat() {
  const inp = document.getElementById('chat-in');
  const msg = inp.value.trim();
  if (!msg) return;

  if (!getApiKey()) { appendBubble('Сначала введите API ключ.', 'ai'); return; }

  inp.value = '';
  appendBubble(msg, 'user');
  const loader = appendBubble('...', 'ai', true);

  const system = `Ты — умный ассистент-планировщик. Отвечай коротко и по делу на русском.
Сегодня: ${new Date().toLocaleDateString('ru-RU')}.
${getEventsContext()}`;

  try {
    const text = await callAI(system, msg);
    loader.className = 'bubble ai';
    loader.textContent = text;
  } catch (e) {
    loader.className = 'bubble ai';
    loader.textContent = e.message === 'NO_KEY' ? 'Введите API ключ.' : 'Ошибка: ' + e.message;
  }

  document.getElementById('chat-msgs').scrollTop = 9999;
}

document.getElementById('btn-plan').onclick = planDay;

document.getElementById('btn-parse').onclick = () => {
  const area = document.getElementById('parse-area');
  const btn = document.getElementById('btn-parse');
  const isOpen = area.style.display !== 'none';
  area.style.display = isOpen ? 'none' : 'flex';
  btn.classList.toggle('active', !isOpen);
};

document.getElementById('btn-analyze').onclick = parseText;
document.getElementById('chat-btn').onclick = sendChat;
document.getElementById('chat-in').onkeydown = e => {
  if (e.key === 'Enter') sendChat();
};

injectKeyInput();
