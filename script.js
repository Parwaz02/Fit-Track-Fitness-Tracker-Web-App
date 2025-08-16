/* ====== State & Storage ====== */
const LS_KEY = 'fittrack_data_v1';
const defaultGoals = { steps: 8000, mins: 30, cals: 500 };
let state = loadState();

/* ====== Elements ====== */
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-panel');
const themeToggle = document.getElementById('theme-toggle');

/* Dashboard elements */
const stepsTodayEl = document.getElementById('steps-today');
const minsTodayEl  = document.getElementById('mins-today');
const calsTodayEl  = document.getElementById('cals-today');
const ringSteps = document.getElementById('ring-steps');
const ringMins  = document.getElementById('ring-mins');
const ringCals  = document.getElementById('ring-cals');
const recentList = document.getElementById('recent-list');
const quickAddForm = document.getElementById('quick-add');
const chartEl = document.getElementById('bar-chart');
const metricChips = document.querySelectorAll('.chip');

/* Workouts table */
const tbody = document.getElementById('workouts-tbody');
const rowTpl = document.getElementById('workout-row-tpl');
const filterType = document.getElementById('filter-type');
const searchWorkouts = document.getElementById('search-workouts');

/* Timer */
const timerDisplay = document.getElementById('timer-display');
const timerTypeSel = document.getElementById('timer-type');
const timerStartBtn = document.getElementById('timer-start');
const timerStopBtn  = document.getElementById('timer-stop');
let timerInterval = null;
let timerStartTime = null;

/* Settings */
const goalsForm = document.getElementById('goals-form');
const goalSteps = document.getElementById('goal-steps');
const goalMins  = document.getElementById('goal-mins');
const goalCals  = document.getElementById('goal-cals');
const exportBtn = document.getElementById('export-json');
const clearBtn  = document.getElementById('clear-data');

/* ====== Init ====== */
document.addEventListener('DOMContentLoaded', () => {
  // Theme
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  if (!state.theme) state.theme = prefersLight ? 'light' : 'dark';
  applyTheme();

  // Goals to form
  goalSteps.value = state.goals.steps;
  goalMins.value  = state.goals.mins;
  goalCals.value  = state.goals.cals;

  // Seed demo if empty
  if (state.workouts.length === 0) seedDemo();

  // Render
  renderAll();

  // Default to Dashboard tab
  document.querySelector('.tab[data-tab="dashboard"]').click();
});

/* ====== Tabs ====== */
tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
    panels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    btn.setAttribute('aria-selected','true');
    document.getElementById(btn.dataset.tab).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

/* ====== Theme ====== */
themeToggle.addEventListener('click', () => {
  state.theme = (state.theme === 'light') ? 'dark' : 'light';
  saveState(); applyTheme();
});
function applyTheme(){
  document.documentElement.classList.toggle('light', state.theme === 'light');
  themeToggle.textContent = state.theme === 'light' ? '🌙' : '☀️';
}

/* ====== Quick Add ====== */
quickAddForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const type = document.getElementById('qa-type').value;
  const duration = +document.getElementById('qa-duration').value;
  const calories = +document.getElementById('qa-calories').value;
  const steps = +(document.getElementById('qa-steps').value || 0);
  const notes = document.getElementById('qa-notes').value.trim();
  addWorkout({ type, duration, calories, steps, notes });
  quickAddForm.reset();
  renderAll();
  toast('Workout added ✅');
});

/* ====== Filters on Workouts ====== */
filterType.addEventListener('change', renderWorkoutsTable);
searchWorkouts.addEventListener('input', renderWorkoutsTable);

/* ====== Timer ====== */
timerStartBtn.addEventListener('click', () => {
  if (timerInterval) return;
  timerStartTime = Date.now();
  timerInterval = setInterval(updateTimerUI, 200);
  timerStartBtn.disabled = true;
  timerStopBtn.disabled = false;
});
timerStopBtn.addEventListener('click', () => {
  if (!timerInterval) return;
  clearInterval(timerInterval);
  timerInterval = null;
  const elapsedMs = Date.now() - timerStartTime;
  const mins = Math.max(1, Math.round(elapsedMs / 60000));
  addWorkout({ type: timerTypeSel.value, duration: mins, calories: 0, steps: 0, notes: 'Logged from timer' });
  timerStartBtn.disabled = false;
  timerStopBtn.disabled = true;
  renderAll();
  toast(`Logged ${mins} min ${timerTypeSel.value} ⏱️`);
});
function updateTimerUI(){
  const diff = Date.now() - timerStartTime;
  timerDisplay.textContent = formatHHMMSS(diff);
}

/* ====== Settings ====== */
goalsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  state.goals.steps = +goalSteps.value || state.goals.steps;
  state.goals.mins  = +goalMins.value  || state.goals.mins;
  state.goals.cals  = +goalCals.value  || state.goals.cals;
  saveState(); renderDashboard();
  toast('Goals updated 🎯');
});
exportBtn.addEventListener('click', () => {
  const dataStr = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
  const a = document.createElement('a');
  a.href = dataStr; a.download = 'fittrack-data.json'; a.click();
});
clearBtn.addEventListener('click', () => {
  if (!confirm('This will remove all workouts and reset goals. Continue?')) return;
  state = { theme: state.theme, goals: { ...defaultGoals }, workouts: [] };
  saveState(); renderAll();
});

/* ====== Core Logic ====== */
function addWorkout({ type, duration, calories, steps, notes }){
  state.workouts.push({
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    type, duration: +duration || 0, calories: +calories || 0, steps: +steps || 0,
    notes: notes || ''
  });
  saveState();
}
function editWorkout(id, updates){
  const w = state.workouts.find(w => w.id === id);
  if (!w) return;
  Object.assign(w, updates);
  saveState();
}
function removeWorkout(id){
  state.workouts = state.workouts.filter(w => w.id !== id);
  saveState();
}

/* ====== Rendering ====== */
function renderAll(){
  renderDashboard();
  renderRecent();
  renderChart();
  renderWorkoutsTable();
}

function renderDashboard(){
  const todayStr = new Date().toISOString().slice(0,10);
  const today = state.workouts.filter(w => (w.date || '').slice(0,10) === todayStr);

  const steps = sum(today.map(w => w.steps));
  const mins  = sum(today.map(w => w.duration));
  const cals  = sum(today.map(w => w.calories));

  stepsTodayEl.textContent = steps.toLocaleString();
  minsTodayEl.textContent  = mins.toString();
  calsTodayEl.textContent  = cals.toString();

  // Update rings with goals
  ringSteps.dataset.value = steps; ringSteps.dataset.goal = state.goals.steps;
  ringMins.dataset.value  = mins;  ringMins.dataset.goal  = state.goals.mins;
  ringCals.dataset.value  = cals;  ringCals.dataset.goal  = state.goals.cals;
  updateRing(ringSteps, '--ring1');
  updateRing(ringMins,  '--ring2');
  updateRing(ringCals,  '--ring3');
}

function renderRecent(){
  const recent = [...state.workouts].sort((a,b) => b.date.localeCompare(a.date)).slice(0,6);
  recentList.innerHTML = recent.map(w => `
    <li>
      <span>${formatDateShort(w.date)} • <strong>${escapeHtml(w.type)}</strong> — ${w.duration}m, ${w.calories}kcal${w.steps?`, ${w.steps} steps`:''}</span>
      <span class="muted">${escapeHtml(w.notes || '')}</span>
    </li>
  `).join('') || '<li class="muted">No workouts yet. Add one!</li>';
}

let currentMetric = 'minutes';
metricChips.forEach(chip => chip.addEventListener('click', () => {
  metricChips.forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  currentMetric = chip.dataset.metric;
  renderChart();
}));

function renderChart(){
  const week = getLast7Days(); // [{label, dayStr}]
  const byDay = week.map(d => ({ ...d, minutes:0, calories:0, steps:0 }));

  state.workouts.forEach(w => {
    const key = (w.date || '').slice(0,10);
    const day = byDay.find(d => d.dayStr === key);
    if (day){
      day.minutes  += w.duration || 0;
      day.calories += w.calories || 0;
      day.steps    += w.steps    || 0;
    }
  });

  const maxVal = Math.max(1, Math.max(...byDay.map(d => d[currentMetric])));
  chartEl.innerHTML = byDay.map(d => {
    const h = (d[currentMetric] / maxVal) * 100;
    return `
      <div class="bar" style="height:${Math.max(4,h)}%" data-label="${d.label}">
        <span class="val">${d[currentMetric] || ''}</span>
      </div>
    `;
  }).join('');
}

function renderWorkoutsTable(){
  const filter = filterType.value;
  const q = (searchWorkouts.value || '').toLowerCase();

  let items = [...state.workouts].sort((a,b) => b.date.localeCompare(a.date));
  if (filter) items = items.filter(w => w.type === filter);
  if (q) items = items.filter(w =>
    (w.type || '').toLowerCase().includes(q) ||
    (w.notes || '').toLowerCase().includes(q)
  );

  tbody.innerHTML = '';
  items.forEach(w => {
    const row = rowTpl.content.firstElementChild.cloneNode(true);
    row.querySelector('.w-date').textContent = formatDateShort(w.date);
    row.querySelector('.w-type').textContent = w.type;
    row.querySelector('.w-duration').textContent = `${w.duration}m`;
    row.querySelector('.w-calories').textContent = `${w.calories}`;
    row.querySelector('.w-steps').textContent = w.steps ? w.steps : '—';
    row.querySelector('.w-notes').textContent = w.notes || '';

    row.querySelector('.edit').addEventListener('click', () => openEdit(row, w));
    row.querySelector('.delete').addEventListener('click', () => {
      if (confirm('Delete this workout?')) { removeWorkout(w.id); renderAll(); }
    });

    tbody.appendChild(row);
  });

  if (items.length === 0){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="7" class="muted">No workouts found.</td>`;
    tbody.appendChild(tr);
  }
}

function openEdit(row, w){
  const tdType = row.querySelector('.w-type');
  const tdDur  = row.querySelector('.w-duration');
  const tdCal  = row.querySelector('.w-calories');
  const tdStep = row.querySelector('.w-steps');
  const tdNote = row.querySelector('.w-notes');
  const actions= row.querySelector('.w-actions');

  tdType.innerHTML = `<select class="mini">
    <option ${w.type==='Run'?'selected':''}>Run</option>
    <option ${w.type==='Walk'?'selected':''}>Walk</option>
    <option ${w.type==='Cycling'?'selected':''}>Cycling</option>
    <option ${w.type==='HIIT'?'selected':''}>HIIT</option>
    <option ${w.type==='Yoga'?'selected':''}>Yoga</option>
    <option ${w.type==='Strength'?'selected':''}>Strength</option>
  </select>`;
  tdDur.innerHTML  = `<input class="mini" type="number" min="1" value="${w.duration}">`;
  tdCal.innerHTML  = `<input class="mini" type="number" min="0" value="${w.calories}">`;
  tdStep.innerHTML = `<input class="mini" type="number" min="0" value="${w.steps}">`;
  tdNote.innerHTML = `<input class="mini" type="text" value="${escapeHtml(w.notes || '')}">`;
  actions.innerHTML = `<button class="icon-btn save">✅</button><button class="icon-btn cancel">↩️</button>`;

  actions.querySelector('.save').addEventListener('click', () => {
    const updates = {
      type: tdType.querySelector('select').value,
      duration: +tdDur.querySelector('input').value,
      calories: +tdCal.querySelector('input').value,
      steps: +tdStep.querySelector('input').value,
      notes: tdNote.querySelector('input').value
    };
    editWorkout(w.id, updates); renderAll(); toast('Saved ✅');
  });
  actions.querySelector('.cancel').addEventListener('click', renderWorkoutsTable);
}

/* ====== Helpers ====== */
function updateRing(el, colorVar){
  const val  = +el.dataset.value || 0;
  const goal = Math.max(1, +el.dataset.goal || 1);
  const pct  = Math.min(100, Math.round((val/goal)*100));
  const deg  = Math.round(360 * pct/100);
  el.style.background = `
    conic-gradient(var(${colorVar}) ${deg}deg, transparent ${deg}deg 360deg),
    radial-gradient(closest-side, var(--card) 82%, transparent 83% 100%),
    radial-gradient(closest-side, rgba(255,255,255,.07), rgba(255,255,255,0))
  `;
}
function getLast7Days(){
  const res = [];
  for (let i=6; i>=0; i--){
    const d = new Date(); d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString(undefined, { weekday:'short' });
    res.push({ label, dayStr: d.toISOString().slice(0,10) });
  }
  return res;
}
function sum(arr){ return arr.reduce((a,b)=>a+(+b||0),0) }
function formatDateShort(iso){
  const d = new Date(iso);
  return d.toLocaleDateString(undefined,{ month:'short', day:'numeric' });
}
function formatHHMMSS(ms){
  const s = Math.floor(ms/1000);
  const hh = String(Math.floor(s/3600)).padStart(2,'0');
  const mm = String(Math.floor((s%3600)/60)).padStart(2,'0');
  const ss = String(s%60).padStart(2,'0');
  return `${hh}:${mm}:${ss}`;
}
function escapeHtml(str){ return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* Storage */
function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { theme: 'dark', goals: { ...defaultGoals }, workouts: [] };
    const parsed = JSON.parse(raw);
    return {
      theme: parsed.theme || 'dark',
      goals: { ...defaultGoals, ...(parsed.goals||{}) },
      workouts: Array.isArray(parsed.workouts) ? parsed.workouts : []
    };
  }catch{
    return { theme: 'dark', goals: { ...defaultGoals }, workouts: [] };
  }
}
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }

/* Seed demo data for nicer first view */
function seedDemo(){
  const today = new Date();
  const mkDay = (shift) => {
    const d = new Date(today); d.setDate(today.getDate()-shift);
    return d.toISOString();
  };
  const demo = [
    { date: mkDay(0), type:'Run', duration:32, calories:310, steps:4200, notes:'Park loops' },
    { date: mkDay(0), type:'Strength', duration:25, calories:180, steps:400, notes:'Push/Pull' },
    { date: mkDay(1), type:'Walk', duration:40, calories:160, steps:5200, notes:'Evening stroll' },
    { date: mkDay(2), type:'Cycling', duration:45, calories:380, steps:0, notes:'Hill reps' },
    { date: mkDay(3), type:'Yoga', duration:30, calories:120, steps:200, notes:'Vinyasa' },
    { date: mkDay(4), type:'HIIT', duration:22, calories:260, steps:800, notes:'EMOM' },
    { date: mkDay(6), type:'Walk', duration:28, calories:110, steps:4100, notes:'Commute' },
  ];
  state.workouts.push(...demo.map(d => ({ id: crypto.randomUUID(), ...d })));
  saveState();
}

/* Small toast */
function toast(msg){
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position:'fixed', bottom:'18px', left:'50%', transform:'translateX(-50%)',
    background:'rgba(0,0,0,.8)', color:'#fff', padding:'10px 14px',
    borderRadius:'999px', zIndex:9999, opacity:'0', transition:'opacity .2s'
  });
  document.body.appendChild(t);
  requestAnimationFrame(()=> t.style.opacity = '1');
  setTimeout(()=> { t.style.opacity='0'; setTimeout(()=>t.remove(), 200); }, 1400);
}
