const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_G = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

const today = new Date();
let cur = { y: today.getFullYear(), m: today.getMonth() };
let selected = null;
window.events = {};

function dateKey(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function buildCells(y, m) {
  const first = new Date(y, m, 1);
  const startOffset = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysInPrev = new Date(y, m, 0).getDate();
  const out = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const pm = m === 0 ? 11 : m - 1;
    out.push({ d: daysInPrev - i, y: m === 0 ? y - 1 : y, m: pm, other: true });
  }
  for (let d = 1; d <= daysInMonth; d++) out.push({ d, y, m, other: false });
  while (out.length % 7 !== 0) {
    const nm = m === 11 ? 0 : m + 1;
    out.push({ d: out.length - daysInMonth - startOffset + 1, y: m === 11 ? y + 1 : y, m: nm, other: true });
  }
  return out;
}

function isToday(c) {
  return c.d === today.getDate() && c.m === today.getMonth() && c.y === today.getFullYear();
}

function renderMain() {
  document.getElementById('main-label').innerHTML = `${MONTHS[cur.m]} <span>${cur.y}</span>`;
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  buildCells(cur.y, cur.m).forEach(c => {
    const key = dateKey(c.y, c.m, c.d);
    const div = document.createElement('div');
    div.className = 'cell'
      + (c.other ? ' other' : ' cur-month')
      + (isToday(c) ? ' is-today' : '')
      + (selected === key ? ' is-selected' : '');
    div.innerHTML = `<div class="num">${String(c.d).padStart(2,'0')}</div>`;
    (events[key] || []).forEach(e => {
      const el = document.createElement('div');
      el.className = 'cell-event';
      el.textContent = e;
      div.appendChild(el);
    });
    div.onclick = () => { selected = key; renderAll(); };
    grid.appendChild(div);
  });
}

function renderMini() {
  document.getElementById('mini-label').textContent = `${MONTHS[cur.m].slice(0,3)} ${cur.y}`;
  const grid = document.getElementById('mini-grid');
  grid.innerHTML = '';

  buildCells(cur.y, cur.m).forEach(c => {
    const key = dateKey(c.y, c.m, c.d);
    const div = document.createElement('div');
    div.className = 'mini-day'
      + (!c.other ? ' cur-month' : '')
      + (isToday(c) ? ' is-today' : '')
      + (selected === key ? ' is-selected' : '')
      + ((events[key] || []).length && selected !== key ? ' has-event' : '');
    div.textContent = c.d;
    div.onclick = () => { selected = key; renderAll(); };
    grid.appendChild(div);
  });
}

function renderPanel() {
  const title = document.getElementById('panel-title');
  const sub = document.getElementById('panel-sub');
  const list = document.getElementById('event-list');
  const addWrap = document.getElementById('add-wrap');

  if (!selected) {
    title.textContent = 'Выберите день';
    sub.textContent = '';
    list.innerHTML = '';
    addWrap.style.display = 'none';
    return;
  }

  const [y, m, d] = selected.split('-');
  title.textContent = `${parseInt(d)} ${MONTHS_G[parseInt(m)-1]}`;
  sub.textContent = parseInt(y) !== today.getFullYear() ? y : '';
  addWrap.style.display = 'flex';
  list.innerHTML = '';

  const evs = events[selected] || [];
  if (!evs.length) {
    list.innerHTML = '<div class="no-ev">Нет событий</div>';
  } else {
    evs.forEach((e, i) => {
      const row = document.createElement('div');
      row.className = 'event-row';
      row.innerHTML = `<span>${e}</span><button class="del" onclick="deleteEvent(${i})">×</button>`;
      list.appendChild(row);
    });
  }
}

function renderUpcoming() {
  const list = document.getElementById('upcoming-list');
  list.innerHTML = '';
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const future = Object.entries(events)
    .filter(([, evs]) => evs.length)
    .map(([key, evs]) => {
      const [y, m, d] = key.split('-').map(Number);
      return { key, evs, dt: new Date(y, m - 1, d) };
    })
    .filter(({ dt }) => dt >= todayMidnight)
    .sort((a, b) => a.dt - b.dt)
    .slice(0, 6);

  if (!future.length) {
    list.innerHTML = '<div class="no-events">Нет предстоящих событий</div>';
    return;
  }

  future.forEach(({ key, evs }) => {
    const [y, m, d] = key.split('-');
    evs.forEach(e => {
      const item = document.createElement('div');
      item.className = 'upcoming-item';
      item.innerHTML = `<div class="ev-date">${parseInt(d)} ${MONTHS_G[parseInt(m)-1]}</div><div class="ev-name">${e}</div>`;
      item.onclick = () => {
        selected = key;
        cur.m = parseInt(m) - 1;
        cur.y = parseInt(y);
        renderAll();
      };
      list.appendChild(item);
    });
  });
}

function renderAll() {
  renderMain();
  renderMini();
  renderPanel();
  renderUpcoming();
}

function deleteEvent(i) {
  events[selected].splice(i, 1);
  renderAll();
}

document.getElementById('ev-add').onclick = () => {
  const inp = document.getElementById('ev-in');
  const val = inp.value.trim();
  if (!val || !selected) return;
  if (!events[selected]) events[selected] = [];
  events[selected].push(val);
  inp.value = '';
  renderAll();
};

document.getElementById('ev-in').onkeydown = e => {
  if (e.key === 'Enter') document.getElementById('ev-add').click();
};

document.getElementById('prev').onclick = () => {
  cur.m--; if (cur.m < 0) { cur.m = 11; cur.y--; } renderAll();
};
document.getElementById('next').onclick = () => {
  cur.m++; if (cur.m > 11) { cur.m = 0; cur.y++; } renderAll();
};
document.getElementById('mp').onclick = () => {
  cur.m--; if (cur.m < 0) { cur.m = 11; cur.y--; } renderAll();
};
document.getElementById('mn').onclick = () => {
  cur.m++; if (cur.m > 11) { cur.m = 0; cur.y++; } renderAll();
};
document.getElementById('go-today').onclick = () => {
  cur = { y: today.getFullYear(), m: today.getMonth() };
  selected = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  renderAll();
};

selected = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
renderAll();
