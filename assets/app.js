/* MATCHPOINT CLUB 2.2 - GITHUB PAGES + DATOS JSON EN REPOSITORIO PRIVADO.
   El modo local continúa disponible hasta conectar GitHub desde Configuración. */
(() => {
  'use strict';

  const STORAGE_KEY = 'matchpoint_demo_local_v1'; // Misma clave: migración sin perder datos de la demo 2.0.
  const PENDING_KEY = 'matchpoint_pending_local_changes_v1';
  const TIMES = ['16:30', '18:00', '19:30', '21:00'];
  const DAYS = ['hoy', 'manana'];
  const WEEK = [
    ['lun', 'Lunes'], ['mar', 'Martes'], ['mie', 'Miércoles'], ['jue', 'Jueves'],
    ['vie', 'Viernes'], ['sab', 'Sábado'], ['dom', 'Domingo']
  ];
  const DAY_KEYS = WEEK.map(([key]) => key);
  const RECENT_MS = 48 * 60 * 60 * 1000;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const localDate = (shift = 0) => {
    const dt = new Date(); dt.setHours(12, 0, 0, 0); dt.setDate(dt.getDate() + shift);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };
  const weekdayKey = date => DAY_KEYS[(new Date(date + 'T12:00:00').getDay() + 6) % 7];
  const relativeDayDate = day => day === 'manana' ? localDate(1) : localDate(0);
  const toLocalTimestamp = value => value ? new Date(value).getTime() : NaN;
  const playedRecently = stamp => {
    const t = toLocalTimestamp(stamp), delta = Date.now() - t;
    return Number.isFinite(delta) && delta >= 0 && delta <= RECENT_MS;
  };
  const prettyDateTime = stamp => {
    const d = new Date(stamp);
    return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d) : '—';
  };
  const dateFromMatch = match => match.date || relativeDayDate(match.day);
  const weekTemplate = () => Object.fromEntries(DAY_KEYS.map(key => [key, { available: [], favorite: [] }]));
  function fromOldAvailability(old) {
    const week = weekTemplate();
    for (const day of DAYS) {
      const key = weekdayKey(relativeDayDate(day));
      week[key].available = (old?.[day] || []).filter(time => TIMES.includes(time));
      week[key].favorite = [];
    }
    return week;
  }
  function validWeek(weekly, fallback) {
    const result = weekTemplate();
    const incoming = weekly && typeof weekly === 'object' ? weekly : fromOldAvailability(fallback);
    for (const key of DAY_KEYS) {
      const data = incoming?.[key];
      result[key].available = [...new Set((Array.isArray(data?.available) ? data.available : []).filter(time => TIMES.includes(time)))];
      result[key].favorite = [...new Set((Array.isArray(data?.favorite) ? data.favorite : []).filter(time => result[key].available.includes(time)))];
    }
    return result;
  }
  const slotsFor = (player, day) => player?.weekAvailability?.[weekdayKey(relativeDayDate(day))]?.available || [];
  const preferredFor = (player, day) => player?.weekAvailability?.[weekdayKey(relativeDayDate(day))]?.favorite || [];
  const dateLabel = date => date === localDate() ? 'Hoy' : date === localDate(1) ? 'Mañana' : new Intl.DateTimeFormat('es-ES', {day: '2-digit', month: 'short', year: 'numeric'}).format(new Date(date + 'T12:00:00'));

  const PAGE_TITLES = {
    resumen: 'Resumen', jugadores: 'Jugadores', partidos: 'Partidos',
    disponibilidad: 'Disponibilidad', pistas: 'Pistas y reservas',
    grupos: 'Grupos por nivel', mensajes: 'Mensajes', informes: 'Informes',
    configuracion: 'Configuración'
  };
  const q = (selector, scope = document) => scope.querySelector(selector);
  const qa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const uid = prefix => prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const dayName = day => day === 'manana' ? 'Mañana' : day === 'hoy' ? 'Hoy' : 'Histórico';
  const numberText = n => Number(n).toLocaleString('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const initials = name => String(name).trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toLocaleUpperCase('es-ES');
  const dateText = () => new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const greeting = () => { const h = new Date().getHours(); return h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'; };
  const makePlayer = (id, name, level, position, playtomic, today, tomorrow) => ({
    id: 'p' + id, name, level, baseLevel: level, position, playtomic,
    playtomicId: '', externalLastAt: '', externalSource: '',
    weekAvailability: fromOldAvailability({ hoy: today, manana: tomorrow })
  });

  function seedState() {
    return {
      schema: 2,
      club: { name: 'Padel Club Centro', manager: 'Alex', courts: 8 },
      players: [
        makePlayer(1, 'Javier Martínez', 3.2, 'Drive', 3.1, ['18:00', '19:30'], ['16:30', '18:00']),
        makePlayer(2, 'Laura García', 3.4, 'Revés', 3.5, ['18:00', '19:30'], ['18:00', '21:00']),
        makePlayer(3, 'Marcos Ruiz', 3.3, 'Drive', 3.2, ['18:00'], ['19:30', '21:00']),
        makePlayer(4, 'Sergio Pérez', 3.5, 'Revés', 3.4, ['18:00'], ['16:30', '18:00']),
        makePlayer(5, 'Ana Castillo', 2.8, 'Ambas', 2.9, ['19:30', '21:00'], ['18:00']),
        makePlayer(6, 'Pedro López', 2.9, 'Revés', 3.0, ['19:30', '21:00'], ['19:30']),
        makePlayer(7, 'Raúl Torres', 3.0, 'Drive', 2.9, ['19:30', '21:00'], ['16:30']),
        makePlayer(8, 'Elena Fernández', 2.8, 'Revés', 2.8, ['19:30', '21:00'], ['19:30']),
        makePlayer(9, 'David Sánchez', 4.1, 'Drive', 4.0, ['21:00'], ['18:00']),
        makePlayer(10, 'Clara Blanco', 4.0, 'Revés', 4.1, ['21:00'], ['19:30']),
        makePlayer(11, 'Álvaro Navarro', 4.2, 'Drive', 4.3, ['21:00'], ['21:00']),
        makePlayer(12, 'Marta Vega', 4.1, 'Revés', 4.0, ['21:00'], ['18:00']),
        makePlayer(13, 'Rubén Ortega', 3.1, 'Drive', 3.0, ['16:30', '19:30'], ['16:30']),
        makePlayer(14, 'Lucía Molina', 3.1, 'Revés', 3.2, ['16:30', '19:30'], ['21:00']),
        makePlayer(15, 'Andrés Gil', 3.2, 'Drive', 3.3, ['16:30', '19:30'], ['18:00']),
        makePlayer(16, 'Paula Romero', 3.0, 'Revés', 3.1, ['16:30', '19:30'], ['21:00']),
        makePlayer(17, 'Inés Moreno', 2.6, 'Drive', 2.7, ['16:30', '21:00'], ['18:00']),
        makePlayer(18, 'Daniel Soto', 2.7, 'Revés', 2.8, ['16:30', '21:00'], ['19:30']),
        makePlayer(19, 'Sara Núñez', 2.8, 'Drive', 2.9, ['16:30', '21:00'], ['16:30']),
        makePlayer(20, 'Hugo Martín', 2.6, 'Revés', 2.6, ['16:30', '21:00'], ['18:00']),
        makePlayer(21, 'Nuria Ibáñez', 3.7, 'Drive', 3.8, ['18:00', '21:00'], ['19:30']),
        makePlayer(22, 'Pablo Herrera', 3.6, 'Revés', 3.6, ['18:00', '21:00'], ['18:00']),
        makePlayer(23, 'Carmen Muñoz', 3.8, 'Drive', 3.7, ['18:00', '21:00'], ['21:00']),
        makePlayer(24, 'Adrián Díaz', 3.7, 'Revés', 3.8, ['18:00', '21:00'], ['16:30'])
      ],
      matches: [
        { id: 'm1', day: 'hoy', date: localDate(), time: '18:00', court: 2, players: ['p1', 'p2', 'p3', 'p4'], status: 'confirmado', confirmations: 4 },
        { id: 'm2', day: 'hoy', date: localDate(), time: '19:30', court: 5, players: ['p5', 'p6', 'p7', 'p8'], status: 'sugerido', confirmations: 0 },
        { id: 'm3', day: 'hoy', date: localDate(), time: '21:00', court: 1, players: ['p9', 'p10', 'p11', 'p12'], status: 'pendiente', confirmations: 2 },
        { id: 'm4', day: 'historico', date: localDate(-1), time: '18:00', court: 1, players: ['p1', 'p2', 'p3', 'p4'], status: 'finalizado', confirmations: 4,
          result: { sets: [[6, 4], [6, 3]], winner: 0, playedAt: `${localDate(-1)}T18:00:00` } },
        { id: 'm5', day: 'historico', date: localDate(-4), time: '19:30', court: 4, players: ['p5', 'p6', 'p7', 'p8'], status: 'finalizado', confirmations: 4,
          result: { sets: [[4, 6], [5, 7]], winner: 1, playedAt: `${localDate(-4)}T19:30:00` } }
      ],
      reservations: [
        { id: 'r1', day: 'hoy', time: '16:30', court: 1, owner: 'Reserva de socios' },
        { id: 'r2', day: 'hoy', time: '18:00', court: 3, owner: 'Reserva externa' },
        { id: 'r3', day: 'hoy', time: '19:30', court: 6, owner: 'Escuela de pádel' },
        { id: 'r4', day: 'hoy', time: '21:00', court: 8, owner: 'Reserva de socios' }
      ],
      messages: [
        { id: 'msg1', audience: 'Partido de las 21:00', content: '¡Hola! Tenemos un partido propuesto para hoy a las 21:00. ¿Te apuntas? Responde para confirmar.', created: 'Ejemplo precargado', status: 'preparado' }
      ],
      activity: [
        { id: 'a1', icon: '✓', title: 'Partido confirmado', description: 'Pista 2 · 18:00 · 4 jugadores', when: 'Dato de ejemplo' },
        { id: 'a2', icon: '◉', title: 'Nueva disponibilidad', description: 'Laura García · Hoy por la tarde', when: 'Dato de ejemplo' },
        { id: 'a3', icon: '✉', title: 'Invitación preparada', description: 'Partido de las 21:00 (no enviada)', when: 'Dato de ejemplo' },
        { id: 'a4', icon: '♙', title: 'Nuevo jugador registrado', description: 'Rubén Ortega', when: 'Dato de ejemplo' }
      ]
    };
  }

  function recalculateLevels() {
    for (const player of state.players) player.level = Number(clamp(Number(player.baseLevel ?? player.level) || 3, 1, 7).toFixed(2));
    const finished = state.matches.filter(m => m.status === 'finalizado' && m.result && m.players?.length === 4)
      .sort((a, b) => toLocalTimestamp(a.result.playedAt) - toLocalTimestamp(b.result.playedAt) || String(a.id).localeCompare(String(b.id)));
    for (const match of finished) {
      const participants = match.players.map(id => state.players.find(p => p.id === id));
      if (participants.some(p => !p) || ![0, 1].includes(match.result.winner)) continue;
      const teamA = (participants[0].level + participants[1].level) / 2;
      const teamB = (participants[2].level + participants[3].level) / 2;
      const expectedA = 1 / (1 + Math.pow(10, (teamB - teamA) / 1.5));
      const changeA = 0.22 * ((match.result.winner === 0 ? 1 : 0) - expectedA);
      match.result.levelChanges = {};
      participants.forEach((player, index) => {
        const before = player.level;
        player.level = Number(clamp(player.level + (index < 2 ? changeA : -changeA), 1, 7).toFixed(2));
        match.result.levelChanges[player.id] = { before, after: player.level, delta: Number((player.level - before).toFixed(2)) };
      });
    }
  }
  function migrateState(data) {
    data.schema = 2;
    for (const player of data.players) {
      if (!Number.isFinite(Number(player.baseLevel))) player.baseLevel = Number(player.level) || 3;
      player.weekAvailability = validWeek(player.weekAvailability, player.availability);
      player.playtomicId = String(player.playtomicId || '');
      player.externalLastAt = String(player.externalLastAt || '');
      player.externalSource = String(player.externalSource || '');
    }
    for (const match of data.matches) {
      if (!match.date) match.date = relativeDayDate(match.day);
      if (match.status === 'finalizado' && match.result && !match.result.playedAt) match.result.playedAt = `${match.date}T${match.time}:00`;
    }
    return data;
  }
  function isCompatibleState(data) {
    return !!data && [1, 2].includes(data.schema) &&
      Array.isArray(data.players) && Array.isArray(data.matches) &&
      Array.isArray(data.reservations) && Array.isArray(data.activity) &&
      Array.isArray(data.messages) && !!data.club &&
      data.players.length <= 1000 && data.matches.length <= 5000 &&
      data.reservations.length <= 2000 && data.activity.length <= 300 &&
      data.messages.length <= 300 &&
      data.players.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' &&
        p.name.length < 80 && Array.isArray(p.availability?.hoy || [])) &&
      data.matches.every(m => m && typeof m.id === 'string' && Array.isArray(m.players) &&
        m.players.length === 4 && m.players.every(id => typeof id === 'string')) &&
      data.reservations.every(r => r && typeof r.id === 'string') &&
      typeof data.club.name === 'string' && typeof data.club.manager === 'string' &&
      Number.isInteger(Number(data.club.courts)) && Number(data.club.courts) >= 2 &&
      Number(data.club.courts) <= 16;
  }
  let storageEnabled = true;
  function loadState() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      const loaded = value ? JSON.parse(value) : seedState();
      if (!isCompatibleState(loaded)) {
        return migrateState(seedState());
      }
      return migrateState(loaded);
    } catch (err) {
      storageEnabled = false;
      return migrateState(seedState());
    }
  }
  let state = loadState();
  recalculateLevels();
  const ui = {
    page: PAGE_TITLES[location.hash.slice(1)] ? location.hash.slice(1) : 'resumen',
    playerSearch: '', levelFilter: '', positionFilter: '', availWeekday: weekdayKey(localDate()),
    courtDay: 'hoy', courtTime: '18:00', matchDay: 'todos'
  };
  let toastTimer;
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); storageEnabled = true; }
    catch (err) { storageEnabled = false; }
  }
  function receiveRemoteState(data) {
    if (!isCompatibleState(data)) throw new Error('La copia remota contiene datos incompatibles.');
    state = migrateState(structuredClone(data));
    recalculateLevels();
    ui.playerSearch = ''; ui.levelFilter = ''; ui.positionFilter = '';
    save();
    try { localStorage.removeItem(PENDING_KEY); } catch (_) {}
    render();
  }
  function updateCloudUI() {
    if (!cloud) return;
    const current = cloud.view();
    if (current.status === 'connected' && !current.dirty) {
      try { localStorage.removeItem(PENDING_KEY); } catch (_) {}
    }
    const badge = q('#cloudStatus');
    if (badge) {
      badge.textContent = current.label;
      badge.dataset.sync = current.status;
      badge.title = current.error || current.label;
    }
    const status = q('#githubStatusValue');
    if (status) status.textContent = current.label;
    const error = q('#githubStatusError');
    if (error) { error.textContent = current.error; error.hidden = !current.error; }
    const alert = q('#syncAlert');
    if (alert) {
      const show = current.status === 'error' || current.status === 'conflict';
      alert.hidden = !show;
      alert.textContent = show ? `${current.label}. ${current.error} Los cambios se conservan en este dispositivo. Abre Configuración para resolverlo.` : '';
    }
  }
  const cloud = window.MatchPointGitHubSync ? new window.MatchPointGitHubSync({
    validateData: isCompatibleState,
    onRemoteData: receiveRemoteState,
    onStatus: updateCloudUI,
    canAutoRefresh: () => !q('#activeModal') && !document.querySelector('.setting-field input:focus, .setting-field textarea:focus, .setting-field select:focus')
  }) : null;
  function notify(message) {
    const toast = q('#toast');
    toast.textContent = String(message);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3700);
  }
  function activity(icon, title, description) {
    state.activity.unshift({ id: uid('a'), icon, title, description, when: 'Ahora · demo local' });
    state.activity = state.activity.slice(0, 30);
  }
  function commit(message) {
    recalculateLevels();
    save();
    try { localStorage.setItem(PENDING_KEY, '1'); } catch (_) {}
    if (cloud) cloud.onLocalChange(state);
    render();
    if (message) notify(message + (cloud?.view().status === 'local' ? ' · Pendiente de sincronizar con GitHub.' : ''));
  }
  function getPlayer(id) { return state.players.find(p => p.id === id); }
  function courtOccupant(day, time, court, omitMatch = '') {
    const match = state.matches.find(m => m.id !== omitMatch && dateFromMatch(m) === relativeDayDate(day) && m.time === time && m.court === court);
    if (match) return { type: 'match', label: 'Partido ' + matchStatus(match).toLowerCase(), item: match };
    const reservation = state.reservations.find(r => r.day === day && r.time === time && r.court === court);
    if (reservation) return { type: 'reservation', label: reservation.owner, item: reservation };
    return null;
  }
  function playerOccupied(id, day, time, omitMatch = '') {
    return state.matches.some(m => m.id !== omitMatch && dateFromMatch(m) === relativeDayDate(day) && m.time === time && m.players.includes(id));
  }
  function freeCourtCount(day, time) {
    let count = 0;
    for (let i = 1; i <= state.club.courts; i++) if (!courtOccupant(day, time, i)) count++;
    return count;
  }
  function availablePlayers(day, time) {
    return state.players.filter(p => slotsFor(p, day).includes(time) && !playerOccupied(p.id, day, time));
  }
  function matchStatus(match) {
    if (match.status === 'finalizado') return 'Finalizado';
    if (match.status === 'confirmado') return 'Confirmado';
    if (match.status === 'pendiente') return 'Pendiente (' + match.confirmations + '/4)';
    return 'Recomendado';
  }
  function sortedMatches() {
    return [...state.matches].sort((a, b) => (a.status === 'finalizado') - (b.status === 'finalizado') ||
      (a.status === 'finalizado' ? dateFromMatch(b).localeCompare(dateFromMatch(a)) : dateFromMatch(a).localeCompare(dateFromMatch(b))) ||
      TIMES.indexOf(a.time) - TIMES.indexOf(b.time) || a.court - b.court);
  }
  function lastPlayed(playerId) {
    return state.matches.filter(m => m.status === 'finalizado' && m.players?.includes(playerId) && m.result?.playedAt)
      .map(m => m.result.playedAt).filter(stamp => Number.isFinite(toLocalTimestamp(stamp)) && toLocalTimestamp(stamp) <= Date.now())
      .sort((a, b) => toLocalTimestamp(b) - toLocalTimestamp(a))[0] || '';
  }
  function clubRecentBadge(playerId) {
    const last = lastPlayed(playerId);
    return playedRecently(last) ? '<span class="activity-pill active">✓ Club · 48 h</span>' :
      '<span class="activity-pill quiet">— Club · sin actividad 48 h</span>';
  }
  function externalRecentBadge(player) {
    if (player.externalSource === 'demo' && player.externalLastAt) {
      return playedRecently(player.externalLastAt) ? '<span class="activity-pill demo">◉ Otro club · demo 48 h</span>' :
        '<span class="activity-pill quiet">— Otro club · demo sin actividad 48 h</span>';
    }
    return '<span class="activity-pill unknown" title="No existe conexión verificada con Playtomic">? Playtomic · sin datos</span>';
  }
  function lastPlayedHTML(playerId) {
    const last = lastPlayed(playerId);
    return last ? `<span class="last-played" title="${escapeHTML(prettyDateTime(last))}"><strong>${escapeHTML(prettyDateTime(last))}</strong><small>${playedRecently(last) ? 'Hace menos de 48 horas' : 'Último partido finalizado'}</small></span>` :
      '<span class="last-played empty-date">Sin partidos disputados registrados</span>';
  }
  function head(title, description, actions = '', eyebrow = 'GESTIÓN DEL CLUB') {
    return `<div class="page-head"><div><div class="eyebrow">${escapeHTML(eyebrow)}</div><h1>${escapeHTML(title)}</h1><p class="sub">${escapeHTML(description)}</p></div><div class="page-actions">${actions}</div></div>`;
  }
  function footer() {
    return `<p class="footer-demo">MATCHPOINT CLUB 2.2 · DEMOSTRACIÓN CON DATOS DE EJEMPLO · PLAYTOMIC NO CONECTADO<br>${cloud?.view().online ? 'Los cambios se guardan en el repositorio privado conectado de GitHub.' : 'Modo local: conecta un repositorio privado en Configuración para compartir datos entre dispositivos.'}</p>`;
  }
  function panelStart(title, subtitle = '', action = '') {
    return `<section class="panel"><div class="panel-head"><div><h2>${escapeHTML(title)}</h2>${subtitle ? `<div class="panel-sub">${escapeHTML(subtitle)}</div>` : ''}</div>${action}</div>`;
  }
  function stat(title, value, sub, icon) {
    return `<div class="stat"><div class="stat-top">${escapeHTML(title)}<span class="stat-icon">${icon}</span></div><div class="stat-num">${value}</div><div class="stat-foot">${sub}</div></div>`;
  }
  function playerName(player, showLast = false) {
    const last = showLast ? lastPlayed(player.id) : '';
    return `<div class="player-name"><div class="mini-avatar">${escapeHTML(initials(player.name))}</div><span class="player-summary"><strong>${escapeHTML(player.name)}</strong>${showLast ? `<small>Última en club: ${escapeHTML(last ? prettyDateTime(last) : 'sin registrar')}</small>` : ''}</span></div>`;
  }
  function playerRows(players, editing = false) {
    if (!players.length) return `<tr><td colspan="${editing ? 9 : 8}" class="muted">No hay jugadores en esta vista.</td></tr>`;
    return players.map(p => {
      const slots = slotsFor(p, 'hoy').length;
      const favorites = preferredFor(p, 'hoy').length;
      return `<tr data-player-id="${escapeHTML(p.id)}" data-player-name="${escapeHTML(p.name.toLocaleLowerCase('es-ES'))}" data-player-level="${escapeHTML(String(p.level))}" data-player-position="${escapeHTML(p.position)}">
        <td>${playerName(p, true)}</td><td class="level">${escapeHTML(p.level.toFixed(2))}</td><td class="position">${escapeHTML(p.position)}</td>
        <td class="${slots ? 'available' : 'unavailable'}">${slots ? `${slots} disponible${slots === 1 ? '' : 's'} hoy` : 'Sin disponibilidad hoy'}${favorites ? `<small class="mini-note">★ ${favorites} favorita${favorites === 1 ? '' : 's'}</small>` : ''}</td>
        <td>${lastPlayedHTML(p.id)}</td><td>${clubRecentBadge(p.id)}</td><td>${externalRecentBadge(p)}</td>
        <td>${p.playtomic == null ? '—' : escapeHTML(numberText(p.playtomic))}</td>
        ${editing ? `<td><div class="row-actions"><button type="button" class="btn-link" data-action="edit-player" data-id="${escapeHTML(p.id)}">Editar</button><button type="button" class="btn-link text-warning" data-action="delete-player" data-id="${escapeHTML(p.id)}">Eliminar</button></div></td>` : ''}
      </tr>`;
    }).join('');
  }
  function table(players, editing = false) {
    return `<div class="table-wrap"><table class="player-table player-table-rich"><thead><tr><th>Jugador</th><th>Nivel club</th><th>Posición</th><th>Hoy</th><th>Última vez en el club</th><th>Club últimos 2 días</th><th>Otro club · Playtomic</th><th>Nivel Playtomic*</th>${editing ? '<th>Acciones</th>' : ''}</tr></thead><tbody id="playersBody">${playerRows(players, editing)}</tbody></table></div>`;
  }
  function levelGroup(player) { return player.level < 3 ? 'iniciacion' : player.level < 3.8 ? 'intermedio' : 'avanzado'; }
  function groupName(g) { return { iniciacion: 'Iniciación · hasta 2.9', intermedio: 'Intermedio · 3.0 a 3.7', avanzado: 'Avanzado · 3.8 o más' }[g] || 'Todos'; }
  function matchCard(match, actions = false) {
    const members = match.players.map(getPlayer);
    const left = members.slice(0, 2), right = members.slice(2, 4);
    const list = players => players.map(p => p ? `<strong>${escapeHTML(p.name.split(' ')[0] + ' ' + (p.name.split(' ')[1] || '').charAt(0) + '.')} · ${escapeHTML(p.position)}</strong><span>Nivel ${escapeHTML(p.level.toFixed(2))}</span>` : '<strong>Jugador eliminado</strong>').join('');
    const valid = members.filter(Boolean);
    const levels = valid.map(p => p.level);
    const gap = levels.length ? (Math.max(...levels) - Math.min(...levels)).toFixed(2) : '-';
    const tagClass = match.status === 'pendiente' ? 'pending' : match.status === 'sugerido' ? 'neutral' : match.status === 'finalizado' ? 'finished' : '';
    const sets = match.result?.sets || [];
    let buttons = '';
    if (actions) {
      if (match.status === 'sugerido') {
        buttons = `<button class="btn btn-sm btn-lime" data-action="confirm-match" data-id="${escapeHTML(match.id)}">✓ Confirmar</button><button class="btn btn-sm btn-outline" data-action="invite-match" data-id="${escapeHTML(match.id)}">✉ Preparar invitaciones</button>`;
      } else if (match.status === 'pendiente') {
        buttons = `<button class="btn btn-sm btn-lime" data-action="confirm-player" data-id="${escapeHTML(match.id)}">✓ Añadir confirmación</button>`;
      } else if (match.status === 'confirmado') {
        buttons = `<button class="btn btn-sm btn-primary" data-action="score-match" data-id="${escapeHTML(match.id)}">🏆 Añadir resultado</button>`;
      } else if (match.status === 'finalizado') {
        buttons = `<button class="btn btn-sm btn-outline" data-action="score-match" data-id="${escapeHTML(match.id)}">Editar marcador</button>`;
        buttons += `<button class="btn btn-sm btn-outline" data-action="remove-result" data-id="${escapeHTML(match.id)}">Anular resultado</button>`;
      }
      buttons += `<button class="btn btn-sm btn-danger" data-action="delete-match" data-id="${escapeHTML(match.id)}">${match.status === 'sugerido' ? 'Descartar' : 'Eliminar partido'}</button>`;
    }
    const levelDetails = (match.result?.levelChanges && members.every(Boolean)) ? `<div class="rating-summary">${members.map(p => {
      const delta = match.result.levelChanges[p.id]?.delta;
      return `<span>${escapeHTML(p.name.split(' ')[0])}: <b class="${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${delta > 0 ? '+' : ''}${escapeHTML(delta?.toFixed(2) || '0.00')}</b></span>`;
    }).join('')}</div>` : '';
    const resultHtml = match.status === 'finalizado' ? `<div class="result-score"><strong>Resultado: ${escapeHTML(sets.map(([a, b]) => a + '–' + b).join(' · '))}</strong><span>Ganadores: pareja ${match.result.winner === 0 ? 'A' : 'B'} · ${escapeHTML(prettyDateTime(match.result.playedAt))}</span>${levelDetails}<small>Cambios en nivel interno, no en Playtomic</small></div>` : '';
    return `<div class="match-card"><div class="match-top"><span class="match-time">${escapeHTML(dateLabel(dateFromMatch(match)).toLocaleUpperCase('es-ES'))} · ${escapeHTML(match.time)} · PISTA ${escapeHTML(match.court)}</span><span class="tag ${tagClass}">${escapeHTML(matchStatus(match))}</span></div>
      <div class="match-body"><div class="team"><div class="player-icon">${escapeHTML(initials(left[0]?.name || 'MP'))}</div><div class="player-pair">${list(left)}</div></div><div class="vs">VS</div><div class="team right"><div class="player-pair">${list(right)}</div><div class="player-icon">${escapeHTML(initials(right[0]?.name || 'MP'))}</div></div></div>
      ${resultHtml}<div class="match-foot"><span>Brecha de nivel: ${escapeHTML(gap)}</span><span>${match.status === 'finalizado' ? 'Resultado registrado' : match.status === 'sugerido' ? 'Sugerencia sin confirmar' : match.confirmations + ' de 4 confirmaciones'}</span></div>
      ${actions ? `<div class="card-actions">${buttons}</div>` : ''}</div>`;
  }
  function courtList(day, time, count = state.club.courts) {
    return `<div class="court-list">${Array.from({ length: Math.min(count, state.club.courts) }, (_, index) => {
      const n = index + 1;
      const busy = courtOccupant(day, time, n);
      return `<div class="court"><div class="court-details"><div class="court-name">Pista ${n}</div><div class="court-time">${escapeHTML(dayName(day))} · ${escapeHTML(time)}${busy ? ' · ' + escapeHTML(busy.label) : ' · Libre para reservar'}</div></div><div class="court-status-line"><span class="status ${busy ? 'busy' : 'free'}">${busy ? 'Ocupada' : 'Disponible'}</span></div></div>`;
    }).join('')}</div>`;
  }
  function recentActivity(max = 4) {
    return state.activity.slice(0, max).map(a => `<div class="activity"><div class="activity-icon">${escapeHTML(a.icon)}</div><div><strong>${escapeHTML(a.title)}</strong><span>${escapeHTML(a.description)} · ${escapeHTML(a.when)}</span></div></div>`).join('');
  }
  function renderDashboard() {
    const todayMatches = state.matches.filter(m => dateFromMatch(m) === localDate() && m.status !== 'sugerido').length;
    const looking = state.players.filter(p => slotsFor(p, 'hoy').length).length;
    return head(`${greeting()}, ${state.club.manager}`, 'Esto es lo que está pasando hoy en tu club de demostración.',
      '<button class="btn btn-outline" data-action="playtomic-info">ⓘ Estado Playtomic</button><button class="btn btn-primary" data-action="add-player">＋ Añadir jugador</button>',
      dateText().toLocaleUpperCase('es-ES')) +
      `<section class="stats">${stat('Jugadores registrados', state.players.length, 'Base de datos de prueba', '♙')}${stat('Partidos para hoy', todayMatches, 'Confirmados o pendientes', '⌁')}${stat('Pistas disponibles', `${freeCourtCount('hoy', '18:00')} <small>/ ${state.club.courts}</small>`, 'Hoy a las 18:00', '▤')}${stat('Jugadores con disponibilidad', looking, 'Para alguna franja de hoy', '◎')}</section>
      <div class="layout"><div>
        ${panelStart('Partidos recomendados', 'Combinaciones según nivel y disponibilidad', '<button class="btn btn-lime" data-action="generate-matches">✦ Generar partidos</button>')}
        ${sortedMatches().filter(m => dateFromMatch(m) === localDate()).slice(0, 3).map(m => matchCard(m)).join('') || '<div class="empty">Todavía no hay partidos. Genera nuevas combinaciones.</div>'}
        <button class="btn-link" data-page="partidos">Gestionar todos los partidos →</button></section>
        ${panelStart('Jugadores', 'Vista rápida de la comunidad del club', '<button class="btn-link" data-page="jugadores">Ver todos →</button>')}
        ${table(state.players.slice(0, 6))}<p class="helper">* Nivel Playtomic de demostración, sin conexión real. Solo los partidos con resultado registrado cuentan como actividad interna y afectan al nivel.</p></section>
      </div><div>
        ${panelStart('Estado de las pistas', 'Hoy · franja 18:00 · demostración', '<button class="btn-link" data-page="pistas">Ver reservas →</button>')}
        ${courtList('hoy', '18:00', 5)}<div class="side-note"><strong>✦ Oportunidad detectada</strong><p>${availablePlayers('hoy', '19:30').length} jugadores libres y ${freeCourtCount('hoy', '19:30')} pistas sin ocupar a las 19:30.</p></div></section>
        ${panelStart('Actividad reciente', 'Movimientos de esta demo sin conexión')}${recentActivity(4)}<button class="btn btn-outline" data-action="send-invites" style="width:100%;justify-content:center;margin-top:12px">Preparar invitaciones de prueba</button></section>
      </div></div>` + footer();
  }
  function renderPlayers() {
    const levelOptions = [['', 'Todos los niveles'], ['iniciacion', 'Iniciación'], ['intermedio', 'Intermedio'], ['avanzado', 'Avanzado']];
    return head('Jugadores', 'Consulta la última fecha jugada, las marcas de actividad reciente y la disponibilidad semanal de cada persona.',
      '<button class="btn btn-primary" data-action="add-player">＋ Nuevo jugador</button>') +
      panelStart('Directorio de jugadores', `${state.players.length} jugadores en esta demo · editable y guardado localmente`) +
      `<div class="filters"><input class="field search" id="searchPlayers" type="search" placeholder="Buscar por nombre…" value="${escapeHTML(ui.playerSearch)}" aria-label="Buscar jugadores">
      <select class="field" id="levelFilter" aria-label="Filtrar por nivel">${levelOptions.map(([v, t]) => `<option value="${escapeHTML(v)}" ${ui.levelFilter === v ? 'selected' : ''}>${escapeHTML(t)}</option>`).join('')}</select>
      <select class="field" id="positionFilter" aria-label="Filtrar por posición"><option value="">Todas las posiciones</option>${['Drive', 'Revés', 'Ambas'].map(v => `<option value="${v}" ${ui.positionFilter === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="filter-count" id="filterCount"></div>${table(state.players, true)}<p class="helper">* Los niveles Playtomic de la demo son ficticios. El indicador de otros clubes aparece como «sin datos» mientras no exista conexión autorizada. Los datos externos de prueba se señalan expresamente como demo.</p></section>` + footer();
  }
  function renderMatches() {
    const choices = [['todos', 'Todos'], ['hoy', 'Hoy'], ['manana', 'Mañana'], ['finalizados', 'Finalizados']];
    const filtered = sortedMatches().filter(m => ui.matchDay === 'todos' || (ui.matchDay === 'finalizados' ? m.status === 'finalizado' : dateFromMatch(m) === relativeDayDate(ui.matchDay)));
    return head('Partidos', 'Registra resultados por sets y actualiza automáticamente los niveles internos de las cuatro personas.',
      '<button class="btn btn-lime" data-action="generate-matches">✦ Generar combinaciones</button><button class="btn btn-primary" data-action="add-match">＋ Crear partido</button>') +
      `<div class="demo-note"><strong>Cálculo de nivel:</strong> al guardar un resultado se reajusta el nivel interno de los dos ganadores y de los dos perdedores. Editar o anular un resultado recalcula el historial sin aplicar cambios duplicados. Las puntuaciones Playtomic no se modifican.</div>
      <div class="pill-tabs">${choices.map(([v, t]) => `<button type="button" data-action="match-day" data-day="${v}" class="${ui.matchDay === v ? 'active' : ''}">${t}</button>`).join('')}</div>
      <div class="cards-grid" style="margin-top:16px">${filtered.length ? filtered.map(m => `<div>${matchCard(m, true)}</div>`).join('') : '<div class="empty"><strong>No hay partidos en esta vista.</strong>Prueba a generar una propuesta o crear un partido.</div>'}</div>` + footer();
  }
  function renderAvailability() {
    const key = ui.availWeekday;
    const label = WEEK.find(([k]) => k === key)?.[1] || 'Lunes';
    return head('Disponibilidad semanal', 'Define por separado cuándo puede jugar cada persona y cuáles son sus franjas favoritas. Se repite cada semana.',
      '<button class="btn btn-outline" data-page="partidos">Ver partidos →</button>') +
      `<div class="pill-tabs weekday-tabs">${WEEK.map(([k, name]) => `<button class="${key === k ? 'active' : ''}" data-action="availability-weekday" data-weekday="${k}">${name}</button>`).join('')}</div>
      <div class="demo-note"><strong>Día seleccionado: ${escapeHTML(label)}.</strong> «Disponible» significa que puede jugar. «Favorita» destaca esa franja para las recomendaciones; requiere que esté disponible. Los cambios se guardan también en la ficha de cada jugador.</div>
      ${panelStart('Franjas por jugador', `${label} · disponibilidad y preferencia editables`)}
      <div class="availability-scroll"><div class="availability-list weekly-list"><div class="availability-row weekly-row is-header"><span>Jugador</span>${TIMES.map(t => `<span style="text-align:center">${t}</span>`).join('')}</div>
      ${state.players.map(p => `<div class="availability-row weekly-row"><div>${playerName(p)}</div>${TIMES.map(time => {
        const available = p.weekAvailability?.[key]?.available.includes(time);
        const favorite = p.weekAvailability?.[key]?.favorite.includes(time);
        const todayKey = weekdayKey(localDate()), tomorrowKey = weekdayKey(localDate(1));
        const busy = ((key === todayKey && playerOccupied(p.id, 'hoy', time)) || (key === tomorrowKey && playerOccupied(p.id, 'manana', time)));
        return `<div class="slot-pair"><button type="button" class="slot-button ${available ? 'selected' : ''}" data-action="toggle-week-slot" data-id="${escapeHTML(p.id)}" data-weekday="${key}" data-time="${time}" aria-pressed="${!!available}" ${busy ? 'disabled title="Tiene un partido asignado a este horario"' : ''}>${busy ? 'En partido' : available ? '✓ Disponible' : '— Disponible'}</button>
          <button type="button" class="slot-button favorite-slot ${favorite ? 'is-favorite' : ''}" data-action="toggle-favorite-slot" data-id="${escapeHTML(p.id)}" data-weekday="${key}" data-time="${time}" aria-pressed="${!!favorite}">${favorite ? '★ Favorita' : '☆ Favorita'}</button></div>`;
      }).join('')}</div>`).join('')}
      </div></div><p class="helper">Las franjas reservadas en partidos de hoy o mañana no pueden desactivarse hasta cancelar el partido. Las preferencias sí se pueden modificar.</p></section>` + footer();
  }
  function renderCourts() {
    const day = ui.courtDay, time = ui.courtTime;
    const reservations = [...state.reservations].sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || TIMES.indexOf(a.time) - TIMES.indexOf(b.time) || a.court - b.court);
    return head('Pistas y reservas', 'Consulta la ocupación por día y franja, y gestiona reservas de prueba.',
      '<button class="btn btn-primary" data-action="add-reservation">＋ Nueva reserva</button>') +
      `<div class="layout-even"><div>${panelStart('Ocupación de pistas', `${freeCourtCount(day, time)} libres / ${state.club.courts} pistas para la franja elegida`)}
      <div class="filters"><select class="field" id="courtDay" aria-label="Día de consulta"><option value="hoy" ${day === 'hoy' ? 'selected' : ''}>Hoy</option><option value="manana" ${day === 'manana' ? 'selected' : ''}>Mañana</option></select>
      <select class="field" id="courtTime" aria-label="Franja de consulta">${TIMES.map(t => `<option ${t === time ? 'selected' : ''}>${t}</option>`).join('')}</select></div>${courtList(day, time)}</section></div>
      <div>${panelStart('Reservas manuales', 'Incluye solo reservas externas o particulares ficticias')}
      ${reservations.length ? reservations.map(r => `<div class="reservation-item"><div><strong>Pista ${r.court}</strong><small>${dayName(r.day)} · ${r.time}</small></div><div>${escapeHTML(r.owner)}</div><span class="tag info">Reservada</span><button class="btn btn-sm btn-danger" data-action="delete-reservation" data-id="${escapeHTML(r.id)}">Cancelar</button></div>`).join('') : '<div class="empty">No hay reservas manuales.</div>'}
      <div class="alert-soft" style="margin-top:15px">Los partidos confirmados o propuestos también ocupan su pista en el calendario de esta demo. Para cancelarlos, utiliza la sección Partidos.</div></section></div></div>` + footer();
  }
  function renderGroups() {
    const groups = [
      { id: 'iniciacion', icon: '◦', text: 'Jugadores que están comenzando.' },
      { id: 'intermedio', icon: '◎', text: 'Jugadores de nivel intermedio.' },
      { id: 'avanzado', icon: '✦', text: 'Jugadores con mayor nivel.' }
    ];
    return head('Grupos por nivel', 'Segmentación automática usando la puntuación interna ficticia.') +
      `<div class="cards-grid">${groups.map(g => {
        const players = state.players.filter(p => levelGroup(p) === g.id).sort((a, b) => a.level - b.level);
        return `<section class="group-card"><div class="group-head"><h2>${escapeHTML(groupName(g.id))}</h2><span class="stat-icon">${g.icon}</span></div><p class="panel-sub">${escapeHTML(g.text)}</p><div class="stat-num" style="margin-bottom:11px">${players.length}<small> jugadores</small></div>
        ${players.slice(0, 7).map(p => `<div class="group-player"><span>${escapeHTML(p.name)}</span><strong>${escapeHTML(numberText(p.level))}</strong></div>`).join('')}${players.length > 7 ? `<p class="helper">… y ${players.length - 7} más</p>` : ''}
        <button class="btn btn-outline" style="margin-top:14px" data-action="view-group" data-group="${g.id}">Ver jugadores del grupo</button></section>`;
      }).join('')}</div>` + footer();
  }
  function renderMessages() {
    return head('Mensajes', 'Prepara invitaciones para copiar o presentar sin enviar SMS, WhatsApp ni emails.',
      '<button class="btn btn-outline" data-action="copy-message" data-id="msg1">Copiar ejemplo</button>') +
      `<div class="layout-even"><div>${panelStart('Preparar un mensaje', 'Queda guardado en este equipo; no se envía a nadie')}
      <form id="messageForm" data-form="message"><div class="setting-field"><label for="audience">Destinatarios simulados</label><select id="audience" name="audience"><option>Todos los jugadores</option><option>Jugadores disponibles hoy</option><option>Grupo iniciación</option><option>Grupo intermedio</option><option>Grupo avanzado</option></select></div>
      <div class="setting-field"><label for="messageText">Texto de la invitación</label><textarea id="messageText" name="content" rows="6" minlength="4" maxlength="1500" required>¡Hola! Tenemos nuevas partidas de pádel disponibles en el club. Confirma tu disponibilidad y te preparamos una propuesta.</textarea></div>
      <button class="btn btn-primary" type="submit">✉ Preparar invitación</button><p class="helper">Esta acción no conecta con WhatsApp ni Playtomic.</p></form></section></div>
      <div>${panelStart('Mensajes preparados', `${state.messages.length} mensajes de demostración`)}
      ${state.messages.length ? [...state.messages].reverse().map(m => `<div class="message-card"><strong>${escapeHTML(m.audience)}</strong><p>${escapeHTML(m.content)}</p><div class="helper"><span>${escapeHTML(m.created)}</span><span class="tag neutral">No enviado</span></div><div class="card-actions"><button class="btn btn-sm btn-outline" data-action="copy-message" data-id="${escapeHTML(m.id)}">Copiar texto</button><button class="btn btn-sm btn-danger" data-action="delete-message" data-id="${escapeHTML(m.id)}">Eliminar</button></div></div>`).join('') : '<div class="empty">Todavía no has preparado ningún mensaje.</div>'}</section></div></div>` + footer();
  }
  function renderReports() {
    const countStatus = status => state.matches.filter(m => m.status === status).length;
    const groups = ['iniciacion', 'intermedio', 'avanzado'];
    const counts = groups.map(g => state.players.filter(p => levelGroup(p) === g).length);
    const max = Math.max(1, ...counts);
    return head('Informes', 'Indicadores calculados a partir de los datos que modificas en la demo.',
      '<button class="btn btn-outline" data-action="export-players">↓ CSV jugadores</button><button class="btn btn-outline" data-action="export-matches">↓ CSV partidos</button>') +
      `<section class="stats">${stat('Jugadores', state.players.length, 'Datos del club', '♙')}${stat('Partidos finalizados', countStatus('finalizado'), 'Con resultado y ajuste de nivel', '🏆')}${stat('Jugadores activos 48 h', state.players.filter(p => playedRecently(lastPlayed(p.id))).length, 'Partidos finalizados del club', '✓')}${stat('Reservas manuales', state.reservations.length, 'Hoy y mañana', '▤')}</section>
      <div class="layout-even"><div>${panelStart('Distribución por nivel', 'Recuento real de jugadores de esta demo')}
      <div class="chart-bars">${counts.map((n, i) => `<div class="chart-bar-col"><div class="chart-bar-value">${n}</div><div class="chart-bar" style="height:${Math.max(4, Math.round(125 * n / max))}px"></div><span class="chart-bar-label">${['Iniciación', 'Intermedio', 'Avanzado'][i]}</span></div>`).join('')}</div>
      <p class="helper" style="margin-top:13px">Se actualiza al añadir, modificar o eliminar jugadores.</p></section></div>
      <div>${panelStart('Descargar datos', 'Archivos generados directamente en el navegador')}
      <div class="court-list"><button class="btn btn-outline" data-action="export-players">↓ Descargar jugadores (CSV)</button><button class="btn btn-outline" data-action="export-matches">↓ Descargar partidos (CSV)</button><button class="btn btn-outline" data-action="export-reservations">↓ Descargar reservas (CSV)</button><button class="btn btn-outline" data-action="export-json">↓ Copia de datos (JSON)</button></div>
      <p class="helper" style="margin-top:14px">Las exportaciones se descargan desde el navegador. Si conectas GitHub, los cambios se sincronizan con el repositorio privado.</p></section></div></div>` + footer();
  }
  function renderSettings() {
    const current = cloud?.view() || { status: 'local', label: 'Modo local', error: '', dirty: false, online: false,
      config: { repository: '', branch: '', path: 'data/matchpoint.json' } };
    const cfg = current.config;
    const actions = current.online ? `
      <div class="cloud-actions">
        <button class="btn btn-outline" data-action="github-reload" ${current.saving || current.loading ? 'disabled' : ''}>↻ Descargar cambios de GitHub</button>
        ${current.status === 'missing' ? '<button class="btn btn-primary" data-action="github-init">Crear base de datos en GitHub</button>' : ''}
        ${current.status === 'error' ? '<button class="btn btn-primary" data-action="github-retry">Reintentar sincronización</button>' : ''}
        <button class="btn btn-outline" data-action="github-upload" ${current.loading || current.saving ? 'disabled' : ''}>↑ Sobrescribir GitHub con datos locales</button>
        <button class="btn btn-outline" data-action="github-disconnect" ${current.loading || current.saving ? 'disabled' : ''}>Desconectar</button>
      </div>` : '';
    return head('Configuración', 'Datos del club y sincronización entre dispositivos mediante GitHub.') +
      `<section class="panel cloud-panel">
        <div class="panel-head"><h2>Base de datos GitHub</h2><p class="panel-sub">JSON en un repositorio privado, sincronizado desde cualquier navegador, incluido el móvil</p></div>
        <div class="cloud-state" data-sync="${current.status}"><span class="sync-dot"></span><strong id="githubStatusValue">${escapeHTML(current.label)}</strong></div>
        <p class="cloud-error" id="githubStatusError" ${current.error ? '' : 'hidden'}>${escapeHTML(current.error)}</p>
        <p class="helper">La aplicación se aloja en GitHub Pages. Los jugadores y resultados se guardan en un <strong>segundo repositorio privado</strong> y no se publican con la web.</p>
        <form id="githubConnectForm" data-form="github-connect" autocomplete="off" class="cloud-form">
          <div class="setting-field"><label for="githubRepo">Repositorio privado (usuario/repositorio)</label><input id="githubRepo" name="repository" maxlength="140" placeholder="usuario/matchpoint-datos" value="${escapeHTML(cfg.repository)}" required></div>
          <div class="setting-field"><label for="githubBranch">Rama (opcional)</label><input id="githubBranch" name="branch" maxlength="200" placeholder="Automática: rama principal" value="${escapeHTML(cfg.branch)}"></div>
          <div class="setting-field"><label for="githubPath">Ruta del archivo JSON</label><input id="githubPath" name="path" maxlength="200" value="${escapeHTML(cfg.path)}" required></div>
          <div class="setting-field"><label for="githubToken">Token de GitHub con permiso Contents: Read and write</label><input id="githubToken" name="token" type="password" autocomplete="new-password" spellcheck="false" placeholder="github_pat_…" required><span class="helper">El token se utiliza solo en esta pestaña. Nunca se guarda en localStorage ni se publica en GitHub. Al recargar deberás introducirlo otra vez.</span></div>
          <button class="btn btn-primary" type="submit">${current.online ? 'Cambiar de repositorio / Reconectar' : 'Conectar y cargar datos de GitHub'}</button>
        </form>
        ${actions}
        <div class="demo-note cloud-warning"><strong>Ediciones simultáneas:</strong> si otro dispositivo modifica la base de datos, GitHub detecta el conflicto y no sobrescribe los cambios automáticamente. Podrás descargar los datos remotos o subir los locales tras confirmarlo.</div>
      </section>
      <div class="layout-even"><div>${panelStart('Datos del club', 'Los cambios se aplican al panel y se sincronizan si estás conectado')}
      <form id="settingsForm" data-form="settings"><div class="setting-field"><label for="clubName">Nombre del club</label><input name="name" id="clubName" maxlength="70" required value="${escapeHTML(state.club.name)}"></div>
      <div class="setting-field"><label for="clubManager">Nombre del administrador</label><input name="manager" id="clubManager" maxlength="40" required value="${escapeHTML(state.club.manager)}"></div>
      <div class="setting-field"><label for="clubCourts">Número de pistas</label><input type="number" name="courts" id="clubCourts" min="2" max="16" required value="${state.club.courts}"><span class="helper">Entre 2 y 16. No se pueden eliminar pistas con reservas o partidos.</span></div>
      <button class="btn btn-primary" type="submit">Guardar configuración</button></form></section></div>
      <div>${panelStart('Copias y datos de demostración', 'Importa o exporta tu archivo JSON en cualquier dispositivo')}
      <div class="demo-note"><strong>${current.online ? 'Conectado a GitHub:' : 'Modo local:'}</strong> ${current.online ? 'los cambios se suben al repositorio. Una importación o reinicio también reemplazará los datos remotos.' : 'hasta conectar GitHub, los cambios solo se guardan en el navegador. Puedes exportar una copia JSON.'}</div>
      <div class="court-list"><button class="btn btn-outline" data-action="export-json">↓ Exportar copia (JSON)</button><label class="btn btn-outline import-file-label">↑ Importar copia (JSON)<input id="importDemoFile" type="file" accept=".json,application/json" class="visually-hidden-input"></label><button class="btn btn-danger" data-action="reset-demo">↻ Restablecer datos de ejemplo</button></div>
      <p class="helper" style="margin-top:17px">${storageEnabled ? '✓ Caché local disponible para recuperación.' : 'Aviso: este navegador no permite almacenar la caché local.'}</p></section></div></div>` + footer();
  }
  const RENDERERS = {
    resumen: renderDashboard, jugadores: renderPlayers, partidos: renderMatches,
    disponibilidad: renderAvailability, pistas: renderCourts, grupos: renderGroups,
    mensajes: renderMessages, informes: renderReports, configuracion: renderSettings
  };
  function render() {
    const node = q('#pageContent');
    node.innerHTML = RENDERERS[ui.page]();
    q('#currentSection').textContent = PAGE_TITLES[ui.page];
    q('#sidebarClubName').textContent = state.club.name;
    qa('[data-page]', q('#mainNav')).forEach(link => {
      const active = link.dataset.page === ui.page;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    updateCloudUI();
    if (ui.page === 'jugadores') applyPlayerFilters();
  }
  function closeSidebar() {
    q('#sidebar').classList.remove('open');
    q('#sidebarOverlay').classList.remove('show');
    q('#mobileMenu').setAttribute('aria-expanded', 'false');
  }
  function goto(page) {
    if (!PAGE_TITLES[page]) return;
    ui.page = page;
    closeSidebar();
    if (location.hash !== '#' + page) location.hash = page;
    render();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function applyPlayerFilters() {
    if (ui.page !== 'jugadores') return;
    const needle = ui.playerSearch.trim().toLocaleLowerCase('es-ES');
    let shown = 0;
    qa('#playersBody tr[data-player-id]').forEach(row => {
      const player = getPlayer(row.dataset.playerId);
      const visible = (!needle || (player?.name || '').toLocaleLowerCase('es-ES').includes(needle)) &&
        (!ui.levelFilter || (player && levelGroup(player) === ui.levelFilter)) &&
        (!ui.positionFilter || player?.position === ui.positionFilter);
      row.hidden = !visible;
      row.style.display = visible ? '' : 'none';
      if (visible) shown++;
    });
    q('#filterCount').textContent = `Mostrando ${shown} de ${state.players.length} jugadores`;
  }

  const options = (items, chosen = '') => items.map(([value, text]) => `<option value="${escapeHTML(value)}" ${String(value) === String(chosen) ? 'selected' : ''}>${escapeHTML(text)}</option>`).join('');
  const weeklyEditor = player => `<div class="form-group full"><label>Disponibilidad semanal y horarios favoritos</label><p class="helper">Cada día tiene sus propias horas. La estrella se puede activar solo para una hora disponible.</p>
    <div class="week-editor">${WEEK.map(([day, label]) => `<div class="week-edit-row"><strong>${label}</strong><div class="week-edit-slots">${TIMES.map(time => {
      const available = player?.weekAvailability?.[day]?.available.includes(time);
      const favorite = player?.weekAvailability?.[day]?.favorite.includes(time);
      return `<span class="week-edit-cell"><small>${time}</small><label><input type="checkbox" name="av_${day}" value="${time}" ${available ? 'checked' : ''}> Libre</label><label class="fav-check"><input type="checkbox" name="fav_${day}" value="${time}" ${favorite ? 'checked' : ''}> ★</label></span>`;
    }).join('')}</div></div>`).join('')}</div></div>`;
  function openModal(content, wide = false) {
    q('#modalRoot').innerHTML = `<div class="modal-backdrop show" id="activeModal"><div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-label="Formulario de demo">${content}</div></div>`;
    q('#activeModal input:not([type=checkbox]), #activeModal select, #activeModal textarea')?.focus();
  }
  function closeModal() { q('#modalRoot').innerHTML = ''; }
  const modalActions = (saveLabel = 'Guardar') => `<div class="form-error" id="modalError" role="alert"></div><div class="modal-actions"><button class="btn btn-outline" type="button" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit">${escapeHTML(saveLabel)}</button></div>`;
  function modalError(message) { const div = q('#modalError'); if (div) { div.textContent = String(message); div.classList.add('show'); } else notify(message); }
  function playerModal(id = '') {
    const p = id ? getPlayer(id) : null;
    if (id && !p) return;
    openModal(`<h3>${p ? 'Ficha y disponibilidad de jugador' : 'Añadir jugador'}</h3><p>Datos de demostración guardados únicamente en este navegador.</p>
      ${p ? `<div class="quick-last"><span>ÚLTIMA VEZ QUE JUGÓ EN ESTE CLUB</span>${lastPlayedHTML(p.id)}<div class="activity-inline">${clubRecentBadge(p.id)} ${externalRecentBadge(p)}</div></div>` : ''}
      <form id="playerForm" data-form="player"><input type="hidden" name="id" value="${escapeHTML(p?.id || '')}">
      <div class="form-grid"><div class="form-group full"><label for="playerName">Nombre completo</label><input id="playerName" name="name" maxlength="70" minlength="2" required placeholder="Ej. Carlos López" value="${escapeHTML(p?.name || '')}"></div>
      <div class="form-group"><label for="playerLevel">Nivel base del club (la demo calcula ajustes por resultados)</label><input id="playerLevel" name="level" type="number" min="1" max="7" step="0.01" required value="${p?.baseLevel ?? 3.2}"></div>
      <div class="form-group"><label for="playerPosition">Posición</label><select id="playerPosition" name="position">${options([['Drive','Drive'],['Revés','Revés'],['Ambas','Ambas']], p?.position || 'Drive')}</select></div>
      <div class="form-group"><label for="playerPlaytomic">Nivel Playtomic (ficticio)</label><input id="playerPlaytomic" name="playtomic" type="number" min="1" max="7" step="0.1" placeholder="Ej. 3.1" value="${p?.playtomic ?? ''}"></div>
      <div class="form-group"><label for="playtomicId">ID del jugador en Playtomic (opcional, futura integración)</label><input id="playtomicId" name="playtomicId" maxlength="80" placeholder="ID vinculado, no verifica actividad" value="${escapeHTML(p?.playtomicId || '')}"></div>
      <div class="form-group full"><label for="externalLastAt">Última actividad en otro club (solo simulación local)</label><input id="externalLastAt" name="externalLastAt" type="datetime-local" value="${escapeHTML(p?.externalSource === 'demo' && p?.externalLastAt ? p.externalLastAt.slice(0, 16) : '')}"><span class="helper">Este campo permite demostrar la marca «otro club», pero NO se obtiene de Playtomic ni acredita un partido real. Sin conexión, se mostrará «Playtomic · sin datos».</span></div>
      ${weeklyEditor(p)}</div>${modalActions(p ? 'Guardar ficha' : 'Añadir jugador')}</form>`, true);
  }
  function matchResultModal(id) {
    const match = state.matches.find(m => m.id === id);
    if (!match || !['confirmado', 'finalizado'].includes(match.status)) return;
    const oldSets = match.result?.sets || [];
    const date = match.result?.playedAt?.slice(0, 10) || (dateFromMatch(match) <= localDate() ? dateFromMatch(match) : localDate());
    const labels = ['Pareja A (jugadores 1 y 2)', 'Pareja B (jugadores 3 y 4)'];
    const setInput = (set, team) => `<input aria-label="Set ${set + 1} · ${labels[team]}" type="number" min="0" max="7" step="1" name="set_${set}_${team}" value="${oldSets[set]?.[team] ?? ''}" ${set < 2 ? 'required' : ''}>`;
    openModal(`<h3>${match.result ? 'Editar resultado de partido' : 'Registrar resultado del partido'}</h3><p>Los resultados del club cambian el nivel interno de los cuatro jugadores. No se sincronizan con Playtomic.</p>
      <div class="score-teams"><div><strong>Pareja A</strong><span>${escapeHTML(match.players.slice(0, 2).map(id => getPlayer(id)?.name || 'Jugador').join(' + '))}</span></div><div><strong>Pareja B</strong><span>${escapeHTML(match.players.slice(2, 4).map(id => getPlayer(id)?.name || 'Jugador').join(' + '))}</span></div></div>
      <form data-form="match-result"><input type="hidden" name="id" value="${escapeHTML(match.id)}"><div class="form-grid">
      <div class="form-group"><label for="playedDate">Fecha en que se jugó</label><input type="date" id="playedDate" name="date" required max="${localDate()}" value="${escapeHTML(date)}"></div>
      <div class="form-group"><label for="playedTime">Hora de inicio</label><input type="time" id="playedTime" name="time" required value="${escapeHTML(match.time)}"></div>
      <div class="form-group full"><label>Marcador por sets</label><div class="score-grid"><span></span><strong>Pareja A</strong><strong>Pareja B</strong>${[0,1,2].map(set => `<span>Set ${set + 1}${set === 2 ? ' (si 1-1)' : ''}</span>${setInput(set,0)}${setInput(set,1)}`).join('')}</div></div></div>
      <p class="helper">Se necesita ganar dos sets. Ejemplos válidos: 6-4, 7-5 y 7-6. Si cada pareja gana un set, rellena el tercero. No se permite registrar resultados futuros.</p>
      ${modalActions(match.result ? 'Actualizar resultado' : 'Guardar resultado y recalcular nivel')}</form>`, true);
  }
  function validSetScore(a, b) {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > 7 || b > 7 || a === b) return false;
    const high = Math.max(a, b), low = Math.min(a, b);
    return (high === 6 && low <= 4) || (high === 7 && (low === 5 || low === 6));
  }
  function submitMatchResult(form) {
    const data = new FormData(form);
    const match = state.matches.find(m => m.id === String(data.get('id') || ''));
    if (!match || !['confirmado', 'finalizado'].includes(match.status)) return modalError('Partido no disponible para registrar resultados.');
    const date = String(data.get('date') || ''), time = String(data.get('time') || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return modalError('Indica una fecha y una hora válidas.');
    const stamp = `${date}T${time}:00`, eventTime = toLocalTimestamp(stamp);
    const parsedDate = new Date(eventTime);
    if (!Number.isFinite(eventTime) || parsedDate.getFullYear() !== Number(date.slice(0, 4)) || parsedDate.getMonth() + 1 !== Number(date.slice(5, 7)) || parsedDate.getDate() !== Number(date.slice(8, 10)) || parsedDate.getHours() !== Number(time.slice(0, 2)) || parsedDate.getMinutes() !== Number(time.slice(3, 5)) || eventTime > Date.now()) return modalError('No se puede registrar un partido futuro ni una fecha inválida.');
    const sets = [];
    for (let i = 0; i < 3; i++) {
      const aText = String(data.get(`set_${i}_0`) ?? ''), bText = String(data.get(`set_${i}_1`) ?? '');
      if (i === 2 && aText.trim() === '' && bText.trim() === '') continue;
      if (aText.trim() === '' || bText.trim() === '') return modalError(`Completa los dos marcadores del set ${i + 1}.`);
      const a = Number(aText), b = Number(bText);
      if (!validSetScore(a, b)) return modalError(`El set ${i + 1} no tiene un marcador válido (ej. 6-4, 7-5 o 7-6).`);
      sets.push([a, b]);
    }
    if (sets.length < 2 || sets.length > 3) return modalError('Registra dos sets y un tercero solo cuando sea necesario.');
    let wins = [0, 0];
    for (const [a, b] of sets) wins[a > b ? 0 : 1]++;
    if (Math.max(...wins) !== 2 || (sets.length === 2 && wins[0] === 1) || (sets.length === 3 && (wins[0] === 3 || wins[1] === 3))) return modalError('El partido debe terminar cuando una pareja gana dos sets.');
    match.result = { sets, winner: wins[0] === 2 ? 0 : 1, playedAt: stamp };
    match.status = 'finalizado'; match.confirmations = 4; match.time = time; match.date = date;
    match.day = date === localDate() ? 'hoy' : date === localDate(1) ? 'manana' : 'historico';
    ui.matchDay = 'finalizados';
    activity('🏆', 'Resultado registrado', `Pista ${match.court} · ${dateLabel(date)} · ${sets.map(([a,b])=>a+'-'+b).join(' / ')}`);
    closeModal(); commit('Resultado guardado. Niveles internos y última fecha jugada actualizados.');
  }
  function reservationModal() {
    openModal(`<h3>Nueva reserva</h3><p>Crea una reserva ficticia para una pista libre.</p><form data-form="reservation"><div class="form-grid">
      <div class="form-group full"><label for="reservationOwner">Reservado por</label><input id="reservationOwner" name="owner" required minlength="2" maxlength="80" placeholder="Ej. Escuela de pádel"></div>
      <div class="form-group"><label for="reservationDay">Día</label><select id="reservationDay" name="day">${options([['hoy','Hoy'],['manana','Mañana']],ui.courtDay)}</select></div>
      <div class="form-group"><label for="reservationTime">Hora</label><select id="reservationTime" name="time">${options(TIMES.map(t => [t,t]),ui.courtTime)}</select></div>
      <div class="form-group full"><label for="reservationCourt">Pista</label><select id="reservationCourt" name="court">${options(Array.from({length:state.club.courts},(_,i)=>[String(i+1),'Pista '+(i+1)]))}</select></div></div>${modalActions('Guardar reserva')}</form>`);
  }
  function manualMatchModal() {
    const choices = state.players.map(p => [p.id, p.name + ' · ' + numberText(p.level)]);
    openModal(`<h3>Crear partido</h3><p>Selecciona una pista libre y cuatro jugadores disponibles para esa franja.</p><form data-form="match"><div class="form-grid">
      <div class="form-group"><label for="matchDay">Día</label><select name="day" id="matchDay">${options([['hoy','Hoy'],['manana','Mañana']])}</select></div>
      <div class="form-group"><label for="matchTime">Hora</label><select name="time" id="matchTime">${options(TIMES.map(t => [t,t]),'19:30')}</select></div>
      <div class="form-group full"><label for="matchCourt">Pista</label><select name="court" id="matchCourt">${options(Array.from({length:state.club.courts},(_,i)=>[String(i+1),'Pista '+(i+1)]))}</select></div>
      ${[1,2,3,4].map(i => `<div class="form-group ${i >= 3 ? '' : ''}"><label for="matchPlayer${i}">Jugador ${i}</label><select name="player${i}" id="matchPlayer${i}">${options([['','Elige jugador…'],...choices])}</select></div>`).join('')}</div>${modalActions('Crear partido confirmado')}</form>`);
  }
  function validateSlotsAgainstMatches(playerId, weekly) {
    return state.matches.find(match => match.status !== 'finalizado' && match.players.includes(playerId) && DAYS.includes(match.day) &&
      dateFromMatch(match) === relativeDayDate(match.day) && !(weekly[weekdayKey(relativeDayDate(match.day))]?.available || []).includes(match.time));
  }
  function submitPlayer(form) {
    const data = new FormData(form);
    const id = String(data.get('id') || '');
    const name = String(data.get('name') || '').trim().replace(/\s+/g, ' ');
    const baseLevel = Number(data.get('level'));
    const position = String(data.get('position') || '');
    const ptText = String(data.get('playtomic') || '').trim();
    const playtomic = ptText === '' ? null : Number(ptText);
    const playtomicId = String(data.get('playtomicId') || '').trim();
    const externalLastAt = String(data.get('externalLastAt') || '').trim();
    const weekAvailability = weekTemplate();
    for (const day of DAY_KEYS) {
      weekAvailability[day].available = data.getAll('av_' + day).filter(time => TIMES.includes(time));
      weekAvailability[day].favorite = data.getAll('fav_' + day).filter(time => TIMES.includes(time));
      // Marcando favorita se activa también disponible.
      for (const time of weekAvailability[day].favorite) if (!weekAvailability[day].available.includes(time)) weekAvailability[day].available.push(time);
    }
    if (name.length < 2 || name.length > 70 || !Number.isFinite(baseLevel) || baseLevel < 1 || baseLevel > 7 ||
        (playtomic !== null && (!Number.isFinite(playtomic) || playtomic < 1 || playtomic > 7)) || playtomicId.length > 80 ||
        !['Drive','Revés','Ambas'].includes(position)) return modalError('Revisa nombre, nivel y posición del jugador.');
    if (externalLastAt && (!Number.isFinite(toLocalTimestamp(externalLastAt)) || toLocalTimestamp(externalLastAt) > Date.now())) return modalError('La actividad externa de demostración debe tener una fecha pasada.');
    if (id) {
      const player = getPlayer(id);
      if (!player) return modalError('No se ha encontrado el jugador.');
      if (validateSlotsAgainstMatches(id, weekAvailability)) return modalError('No puedes eliminar la disponibilidad de un partido asignado. Cancela antes ese partido.');
      Object.assign(player, { name, baseLevel, position, playtomic, playtomicId, externalLastAt, externalSource: externalLastAt ? 'demo' : '', weekAvailability });
      activity('♙', 'Jugador actualizado', name);
    } else {
      state.players.unshift({ id: uid('p'), name, level: baseLevel, baseLevel, position, playtomic, playtomicId,
        externalLastAt, externalSource: externalLastAt ? 'demo' : '', weekAvailability });
      activity('♙', 'Jugador registrado', name);
    }
    closeModal(); commit(id ? 'Ficha semanal actualizada en la demo.' : 'Jugador añadido a la demo.');
  }
  function submitReservation(form) {
    const data = new FormData(form), owner = String(data.get('owner') || '').trim();
    const day = String(data.get('day')), time = String(data.get('time')), court = Number(data.get('court'));
    if (owner.length < 2 || owner.length > 80 || !DAYS.includes(day) || !TIMES.includes(time) || court < 1 || court > state.club.courts || !Number.isInteger(court)) return modalError('Completa correctamente todos los campos.');
    if (courtOccupant(day, time, court)) return modalError('La pista está ocupada en esa franja. Elige otra pista u otra hora.');
    state.reservations.push({ id: uid('r'), owner, day, time, court });
    ui.courtDay = day; ui.courtTime = time;
    activity('▤', 'Reserva creada', `Pista ${court} · ${dayName(day)} ${time}`);
    closeModal(); commit('Reserva guardada en esta demo.');
  }
  function submitManualMatch(form) {
    const data = new FormData(form);
    const day = String(data.get('day')), time = String(data.get('time')), court = Number(data.get('court'));
    const selected = [1,2,3,4].map(n => String(data.get('player' + n) || ''));
    if (!DAYS.includes(day) || !TIMES.includes(time) || !Number.isInteger(court) || court < 1 || court > state.club.courts) return modalError('Día, hora o pista incorrectos.');
    if (selected.some(id => !id || !getPlayer(id)) || new Set(selected).size !== 4) return modalError('Selecciona cuatro jugadores diferentes.');
    if (courtOccupant(day, time, court)) return modalError('La pista seleccionada está ocupada en esa franja.');
    if (selected.some(id => !slotsFor(getPlayer(id), day).includes(time))) return modalError('Alguno de los jugadores no está disponible en ese día y hora. Ajusta su disponibilidad.');
    if (selected.some(id => playerOccupied(id, day, time))) return modalError('Uno de los jugadores ya participa en otro partido a esa hora.');
    state.matches.push({ id: uid('m'), day, date: relativeDayDate(day), time, court, players: selected, status: 'confirmado', confirmations: 4 });
    activity('✓', 'Partido creado', `Pista ${court} · ${dayName(day)} ${time}`);
    ui.matchDay = day;
    closeModal(); commit('Partido creado y confirmado en la demo.');
  }
  function submitMessage(form) {
    const data = new FormData(form);
    const audience = String(data.get('audience') || '').trim();
    const content = String(data.get('content') || '').trim();
    if (content.length < 4 || content.length > 1500) return notify('El mensaje debe tener entre 4 y 1500 caracteres.');
    state.messages.push({ id: uid('msg'), audience, content, created: dateText(), status: 'preparado' });
    activity('✉', 'Mensaje preparado', audience + ' · no enviado');
    commit('Mensaje guardado. No se ha enviado.');
  }
  function submitSettings(form) {
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const manager = String(data.get('manager') || '').trim();
    const courts = Number(data.get('courts'));
    const maxAssigned = Math.max(0, ...state.matches.map(m => m.court), ...state.reservations.map(r => r.court));
    if (!name || name.length > 70 || !manager || manager.length > 40 || !Number.isInteger(courts) || courts < 2 || courts > 16) return notify('Revisa el nombre, administrador y número de pistas (2 a 16).');
    if (courts < maxAssigned) return notify(`No puedes reducir a ${courts} pistas porque existe una reserva o partido en la pista ${maxAssigned}.`);
    state.club = { name, manager, courts };
    activity('⚙', 'Configuración actualizada', name + ' · ' + courts + ' pistas');
    commit('Configuración local guardada.');
  }

  function arrangeTeams(players) {
    // Dos parejas Drive/Revés, equilibrando el promedio de cada equipo.
    // "Ambas" puede ocupar cualquiera de las dos posiciones.
    const canDrive = p => p.position !== 'Revés';
    const canBackhand = p => p.position !== 'Drive';
    let best = null, bestScore = Infinity;
    for (const a of players) for (const b of players) {
      if (b.id === a.id || !canDrive(a) || !canBackhand(b)) continue;
      const remaining = players.filter(p => p.id !== a.id && p.id !== b.id);
      const permutations = [[remaining[0], remaining[1]], [remaining[1], remaining[0]]];
      for (const [c, d] of permutations) {
        if (!canDrive(c) || !canBackhand(d)) continue;
        const score = Math.abs((a.level + b.level) - (c.level + d.level));
        if (score < bestScore) { best = [a, b, c, d]; bestScore = score; }
      }
    }
    return best;
  }

  function generateMatches() {
    // Generación demostrativa local. Prioriza grupos compactos de nivel similar.
    let created = 0;
    for (const day of DAYS) {
      for (const time of TIMES) {
        if (created >= 3) break;
        const court = Array.from({ length: state.club.courts }, (_, i) => i + 1).find(n => !courtOccupant(day, time, n));
        if (!court) continue;
        const available = availablePlayers(day, time).sort((a, b) => a.level - b.level);
        if (available.length < 4) continue;
        let selected = null, bestMatchScore = Infinity;
        for (let i = 0; i <= available.length - 4; i++) {
          const candidate = available.slice(i, i + 4);
          const spread = candidate[3].level - candidate[0].level;
          if (spread > 0.65) continue;
          const drives = candidate.filter(p => p.position === 'Drive' || p.position === 'Ambas').length;
          const backhands = candidate.filter(p => p.position === 'Revés' || p.position === 'Ambas').length;
          if (drives < 2 || backhands < 2) continue;
          const possible = arrangeTeams(candidate);
          if (!possible) continue;
          const favoriteCount = candidate.filter(p => preferredFor(p, day).includes(time)).length;
          const fairness = Math.abs((possible[0].level + possible[1].level) - (possible[2].level + possible[3].level));
          const score = spread + fairness * 0.45 - favoriteCount * 0.09;
          if (score < bestMatchScore) { selected = possible; bestMatchScore = score; }
        }
        if (!selected) continue;
        state.matches.push({ id: uid('m'), day, date: relativeDayDate(day), time, court, players: selected.map(p => p.id), status: 'sugerido', confirmations: 0 });
        created++;
      }
      if (created >= 3) break;
    }
    if (created) {
      activity('✦', 'Combinaciones generadas', `${created} partidos propuestos en modo local`);
      ui.matchDay = 'todos';
      commit(`${created} partido${created === 1 ? '' : 's'} recomendado${created === 1 ? '' : 's'} generado${created === 1 ? '' : 's'}.`);
    } else notify('No hay cuatro jugadores compatibles y una pista libre en las franjas restantes. Prueba a modificar la disponibilidad.');
  }
  function inviteMatch(match) {
    const names = match.players.map(id => getPlayer(id)?.name || 'Jugador').join(', ');
    const text = `Hola, tenemos un partido de pádel propuesto para ${dayName(match.day).toLowerCase()} a las ${match.time} en la pista ${match.court}. Jugadores: ${names}. Confirma si puedes asistir. (Mensaje de demostración)`;
    state.messages.push({ id: uid('msg'), audience: `Partido ${dayName(match.day).toLowerCase()} ${match.time}`, content: text, created: dateText(), status: 'preparado' });
    if (match.status === 'sugerido') { match.status = 'pendiente'; match.confirmations = 0; }
    activity('✉', 'Invitaciones preparadas', `Partido de las ${match.time} · ningún envío real`);
    commit('Invitaciones preparadas en Mensajes. No se ha enviado nada.');
  }
  function escapeCSVCell(value) {
    let text = String(value == null ? '' : value);
    if (/^\s*[=+@\-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function makeCSV(rows) { return '\ufeff' + rows.map(row => row.map(escapeCSVCell).join(';')).join('\r\n'); }
  function downloadFile(name, data, type) {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  function exportFile(which) {
    if (which === 'json') {
      downloadFile('matchpoint-demo-datos.json', JSON.stringify(state, null, 2), 'application/json;charset=utf-8');
    } else if (which === 'players') {
      downloadFile('matchpoint-jugadores.csv', makeCSV([
        ['ID','Nombre','Nivel base club','Nivel actual club','Posición','Playtomic ficticio','Último partido club','Jugó club 48 h','Otro club 48 h (demo/no verificado)','ID Playtomic'] .concat(WEEK.flatMap(([key, name]) => [name + ' disponibles', name + ' favoritos'])),
        ...state.players.map(p => [p.id,p.name,p.baseLevel,p.level,p.position,p.playtomic,lastPlayed(p.id),playedRecently(lastPlayed(p.id)) ? 'Sí' : 'No',p.externalSource === 'demo' ? (playedRecently(p.externalLastAt) ? 'Demo: sí' : 'Demo: no') : 'Sin datos Playtomic',p.playtomicId]
          .concat(DAY_KEYS.flatMap(key => [(p.weekAvailability?.[key]?.available || []).join(', '), (p.weekAvailability?.[key]?.favorite || []).join(', ')])))
      ]), 'text/csv;charset=utf-8');
    } else if (which === 'matches') {
      downloadFile('matchpoint-partidos.csv', makeCSV([
        ['ID','Fecha','Hora','Pista','Estado','Confirmaciones','Jugadores','Sets','Pareja ganadora','Fecha jugado'],
        ...sortedMatches().map(m => [m.id,dateFromMatch(m),m.time,m.court,matchStatus(m),m.confirmations,m.players.map(id => getPlayer(id)?.name || 'Eliminado').join(' / '),
          (m.result?.sets || []).map(([a, b]) => a+'-'+b).join(' / '), m.result ? m.result.winner === 0 ? 'A' : 'B' : '',m.result?.playedAt || ''])
      ]), 'text/csv;charset=utf-8');
    } else if (which === 'reservations') {
      downloadFile('matchpoint-reservas.csv', makeCSV([
        ['ID','Día','Hora','Pista','Titular'], ...state.reservations.map(r => [r.id,dayName(r.day),r.time,r.court,r.owner])
      ]), 'text/csv;charset=utf-8');
    }
    notify('Archivo generado localmente.');
  }
  async function importDemoJSON(file) {
    if (!file || file.size > 2 * 1024 * 1024) return notify('Selecciona una copia JSON de menos de 2 MB.');
    let imported;
    try { imported = JSON.parse(await file.text()); }
    catch (error) { return notify('No se ha podido leer el JSON. Comprueba que sea una copia de MatchPoint.'); }
    if (!isCompatibleState(imported)) {
      return notify('El archivo no contiene una copia válida de MatchPoint 2.0/2.1.');
    }
    if (!confirm('¿Importar esta copia? Reemplazará jugadores, partidos, disponibilidad y reservas de la demo actual.')) return;
    if (cloud?.view().online && !confirm('Esta importación también sustituirá todos los datos guardados en GitHub. ¿Continuar?')) return;
    const originalSchema = imported.schema;
    try { state = migrateState(imported); }
    catch (error) { return notify('La copia contiene datos incompatibles. No se ha importado.'); }
    ui.playerSearch = ''; ui.positionFilter = ''; ui.levelFilter = '';
    activity('↓', 'Copia importada', `Versión ${originalSchema === 2 ? '2.1' : '2.0'} · ${state.players.length} jugadores`);
    commit('Copia importada y migrada correctamente.');
  }
  async function copyMessage(message) {
    if (!message) return notify('Mensaje no encontrado.');
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(message.content); notify('Texto copiado al portapapeles.'); return; }
      const input = document.createElement('textarea');
      input.value = message.content; input.style.position = 'fixed'; input.style.opacity = '0';
      document.body.appendChild(input); input.select();
      const ok = document.execCommand('copy'); input.remove();
      notify(ok ? 'Texto copiado al portapapeles.' : 'No se ha podido copiar. Selecciónalo desde Mensajes.');
    } catch (err) { notify('No se ha podido copiar. Abre Mensajes y selecciona el texto.'); }
  }
  async function handleGitHubAction(action) {
    if (!cloud) return notify('Este paquete no incluye el conector de GitHub.');
    const current = cloud.view();
    try {
      switch (action) {
        case 'github-init':
          if (!confirm('¿Crear data/matchpoint.json en GitHub con los datos que se muestran ahora?')) return;
          await cloud.initialize(state);
          notify('Base de datos privada creada en GitHub.');
          break;
        case 'github-reload':
          if (current.dirty && !confirm('Hay cambios locales no sincronizados. ¿Descartarlos y cargar GitHub?')) return;
          await cloud.refresh({ discardLocal: true });
          notify('Datos de GitHub comprobados y actualizados.');
          break;
        case 'github-upload':
          if (!confirm('ATENCIÓN: esto sustituirá el archivo remoto con los datos de este dispositivo y puede borrar cambios hechos en otro. ¿Sobrescribir GitHub?')) return;
          await cloud.forceUpload(state);
          notify('Datos locales publicados en GitHub.');
          break;
        case 'github-retry':
          cloud.retry();
          notify('Reintentando la sincronización pendiente.');
          break;
        case 'github-disconnect':
          if (current.dirty && !confirm('Hay cambios pendientes. Si desconectas, solo quedarán en este dispositivo. ¿Continuar?')) return;
          cloud.disconnect();
          notify('GitHub desconectado de esta pestaña. Los datos locales se conservan.');
          break;
      }
    } catch (error) {
      notify('Error: ' + error.message);
    } finally {
      render();
    }
  }
  async function submitGitHubConnection(form) {
    if (!cloud) return notify('No se ha cargado el conector GitHub.');
    let hasPendingLocal = false;
    try { hasPendingLocal = localStorage.getItem(PENDING_KEY) === '1'; } catch (_) {}
    let preserveLocalData = null;
    if (hasPendingLocal) {
      if (confirm('Hay modificaciones locales que NO se han subido. Aceptar: CONSERVAR datos locales para resolver el conflicto después. Cancelar: descartar esos cambios y descargar GitHub.')) {
        preserveLocalData = state;
      } else if (!confirm('¿Confirmas que quieres DESCARTAR los cambios locales y cargar la versión de GitHub?')) return;
    } else if (!confirm('Se cargarán los datos de GitHub y se sustituirá la copia local si ya existe. ¿Continuar?')) return;
    try {
      const exists = await cloud.connect({
        repository: form.elements.namedItem('repository').value,
        branch: form.elements.namedItem('branch').value,
        path: form.elements.namedItem('path').value,
        token: form.elements.namedItem('token').value
      }, { preserveLocalData });
      notify(exists ? (preserveLocalData ? 'Cambios locales conservados: resuelve el conflicto en Configuración.' : 'Conectado: los datos se han cargado desde GitHub.') : 'Repositorio conectado. Ahora crea la base de datos JSON.');
    } catch (error) { notify('No se pudo conectar: ' + error.message); }
    finally { render(); }
  }
  function handleAction(button) {
    const action = button.dataset.action;
    const id = button.dataset.id;
    const match = state.matches.find(m => m.id === id);
    const reservation = state.reservations.find(r => r.id === id);
    const message = state.messages.find(m => m.id === id);
    if (action.startsWith('github-')) { handleGitHubAction(action); return; }
    switch (action) {
      case 'add-player': playerModal(); break;
      case 'edit-player': playerModal(id); break;
      case 'close-modal': closeModal(); break;
      case 'delete-player': {
        const player = getPlayer(id);
        if (!player) break;
        if (state.matches.some(m => m.players.includes(id))) return notify('No puedes eliminar un jugador con partidos asignados. Cancela primero sus partidos.');
        if (!confirm(`¿Eliminar a ${player.name} de la demo local?`)) break;
        state.players = state.players.filter(p => p.id !== id);
        activity('♙', 'Jugador eliminado', player.name);
        commit('Jugador eliminado de la demo.'); break;
      }
      case 'playtomic-info':
        openModal(`<h3>Integración Playtomic</h3><p>Estado actual: sin conexión real.</p><div class="demo-note"><strong>Datos externos no verificables en esta demo.</strong> Playtomic ofrece una API oficial para reservas y jugadores de los clubes autorizados. No expone necesariamente partidos en cualquier club ajeno. Por eso «Playtomic · sin datos» nunca significa que el jugador no haya jugado fuera.</div><p>El campo «última actividad externa» de cada jugador es solo una simulación local, con etiqueta demo, no un dato sincronizado. Para verificarlo en producción será necesario solicitar acceso, vincular IDs de los jugadores y utilizar únicamente las sedes permitidas por Playtomic.</p><div class="modal-actions"><button class="btn btn-primary" data-action="close-modal">Entendido</button></div>`, true); break;
      case 'generate-matches': generateMatches(); break;
      case 'add-reservation': reservationModal(); break;
      case 'add-match': manualMatchModal(); break;
      case 'score-match': matchResultModal(id); break;
      case 'remove-result': {
        if (match?.status !== 'finalizado' || !match.result) break;
        if (!confirm('¿Anular el resultado? Se recalcularán los niveles del club y las fechas de actividad.')) break;
        delete match.result;
        match.status = 'confirmado';
        activity('↶', 'Resultado anulado', `Partido en pista ${match.court}`);
        commit('Resultado anulado y niveles recalculados.'); break;
      }
      case 'delete-reservation':
        if (reservation && confirm(`¿Cancelar la reserva de la pista ${reservation.court} a las ${reservation.time}?`)) {
          state.reservations = state.reservations.filter(r => r.id !== id);
          activity('▤', 'Reserva cancelada', `Pista ${reservation.court} · ${reservation.time}`);
          commit('Reserva cancelada.');
        } break;
      case 'confirm-match':
        if (!match) break;
        if (state.reservations.some(r => r.day === match.day && r.time === match.time && r.court === match.court)) return notify('La pista ya está reservada. No se puede confirmar.');
        match.status = 'confirmado'; match.confirmations = 4;
        activity('✓', 'Partido confirmado', `Pista ${match.court} · ${match.time}`);
        commit('Partido confirmado en la demo.'); break;
      case 'confirm-player':
        if (!match || match.status !== 'pendiente') break;
        match.confirmations = Math.min(4, match.confirmations + 1);
        if (match.confirmations === 4) match.status = 'confirmado';
        activity('✓', 'Confirmación registrada', `${match.confirmations}/4 · Pista ${match.court}`);
        commit(match.status === 'confirmado' ? '¡Partido confirmado! Ya están los cuatro jugadores.' : `Confirmación registrada (${match.confirmations}/4).`); break;
      case 'invite-match': if (match) inviteMatch(match); break;
      case 'send-invites': {
        const first = state.matches.find(m => m.status === 'sugerido');
        if (first) inviteMatch(first);
        else { goto('mensajes'); notify('No hay partidos recomendados pendientes. Puedes preparar un mensaje de demostración aquí.'); }
        break;
      }
      case 'delete-match':
        if (match && confirm(`¿${match.status === 'sugerido' ? 'Descartar' : 'Cancelar'} el partido de las ${match.time} en la pista ${match.court}?`)) {
          state.matches = state.matches.filter(m => m.id !== id);
          activity('⌁', 'Partido cancelado', `Pista ${match.court} · ${match.time}`);
          commit('Partido retirado de la demo.');
        } break;
      case 'match-day': ui.matchDay = button.dataset.day; render(); break;
      case 'availability-weekday':
        if (DAY_KEYS.includes(button.dataset.weekday)) { ui.availWeekday = button.dataset.weekday; render(); }
        break;
      case 'toggle-week-slot':
      case 'toggle-favorite-slot': {
        const player = getPlayer(id), weekday = button.dataset.weekday, time = button.dataset.time;
        if (!player || !DAY_KEYS.includes(weekday) || !TIMES.includes(time)) break;
        const row = player.weekAvailability[weekday];
        if (action === 'toggle-week-slot') {
          if (row.available.includes(time)) {
            const booked = DAYS.some(day => weekdayKey(relativeDayDate(day)) === weekday && playerOccupied(id, day, time));
            if (booked) return notify('Este jugador tiene un partido reservado. No puedes quitar esa disponibilidad.');
            row.available = row.available.filter(t => t !== time);
            row.favorite = row.favorite.filter(t => t !== time);
          } else row.available.push(time);
        } else if (row.favorite.includes(time)) row.favorite = row.favorite.filter(t => t !== time);
        else { row.favorite.push(time); if (!row.available.includes(time)) row.available.push(time); }
        row.available.sort((a, b) => TIMES.indexOf(a) - TIMES.indexOf(b));
        row.favorite.sort((a, b) => TIMES.indexOf(a) - TIMES.indexOf(b));
        activity('◉', 'Agenda semanal', `${player.name} · ${weekday} · ${time}`);
        commit('Disponibilidad y favoritos semanales actualizados.'); break;
      }
      case 'view-group': ui.levelFilter = button.dataset.group; ui.playerSearch = ''; ui.positionFilter = ''; goto('jugadores'); break;
      case 'copy-message': copyMessage(message); break;
      case 'delete-message':
        if (message && confirm('¿Eliminar el mensaje preparado de la demo?')) {
          state.messages = state.messages.filter(m => m.id !== id);
          commit('Mensaje eliminado.');
        } break;
      case 'export-players': exportFile('players'); break;
      case 'export-matches': exportFile('matches'); break;
      case 'export-reservations': exportFile('reservations'); break;
      case 'export-json': exportFile('json'); break;
      case 'reset-demo':
        if (confirm(cloud?.view().online ? '¿Restablecer todos los datos originales de la demo, incluidos los compartidos en GitHub?' : '¿Restablecer todos los datos originales de la demo? Se perderán los cambios locales.')) {
          state = seedState(); ui.playerSearch = ''; ui.levelFilter = ''; ui.positionFilter = '';
          commit('Datos de demostración restaurados.');
        } break;
    }
  }
  document.addEventListener('click', event => {
    if (event.target === q('#sidebarOverlay')) { closeSidebar(); return; }
    if (event.target.closest('#mobileMenu')) {
      const open = q('#sidebar').classList.toggle('open');
      q('#sidebarOverlay').classList.toggle('show', open);
      q('#mobileMenu').setAttribute('aria-expanded', String(open));
      return;
    }
    if (event.target === q('#activeModal')) { closeModal(); return; }
    const navigate = event.target.closest('[data-page]');
    if (navigate) { event.preventDefault(); goto(navigate.dataset.page); return; }
    const button = event.target.closest('[data-action]');
    if (button) { event.preventDefault(); handleAction(button); }
  });
  document.addEventListener('submit', event => {
    const form = event.target.closest('[data-form]');
    if (!form) return;
    event.preventDefault();
    switch (form.dataset.form) {
      case 'player': submitPlayer(form); break;
      case 'reservation': submitReservation(form); break;
      case 'match': submitManualMatch(form); break;
      case 'match-result': submitMatchResult(form); break;
      case 'message': submitMessage(form); break;
      case 'settings': submitSettings(form); break;
      case 'github-connect': submitGitHubConnection(form); break;
    }
  });
  document.addEventListener('input', event => {
    if (event.target.matches('#searchPlayers')) {
      ui.playerSearch = event.target.value;
      applyPlayerFilters();
    }
  });
  document.addEventListener('change', event => {
    if (event.target.matches('#importDemoFile')) {
      importDemoJSON(event.target.files?.[0]); return;
    }
    if (event.target.matches('#levelFilter')) { ui.levelFilter = event.target.value; applyPlayerFilters(); }
    if (event.target.matches('#positionFilter')) { ui.positionFilter = event.target.value; applyPlayerFilters(); }
    if (event.target.matches('#courtDay')) { ui.courtDay = event.target.value; render(); }
    if (event.target.matches('#courtTime')) { ui.courtTime = event.target.value; render(); }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closeModal(); closeSidebar(); }
  });
  window.addEventListener('hashchange', () => {
    const page = location.hash.slice(1);
    if (PAGE_TITLES[page] && page !== ui.page) { ui.page = page; closeSidebar(); render(); }
  });

  // Caché local: GitHub es la fuente de datos tras conectarse desde Configuración.
  if (storageEnabled) save();
  render();
})();
