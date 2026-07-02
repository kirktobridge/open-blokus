/**
 * Self-contained admin panel page (HTML + CSS + vanilla JS, no build step).
 * Served by the game server at GET /admin behind Basic auth. All fetches are
 * same-origin, so the browser resends the Basic-auth credential automatically.
 */
export function adminPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>OpenBlokus Admin</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; font: 14px/1.5 system-ui, sans-serif;
    background: #14161c; color: #e6e8ee;
  }
  header {
    display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
    padding: 1rem 1.25rem; background: #1c1f28; border-bottom: 1px solid #2a2e3a;
  }
  header h1 { font-size: 1.1rem; margin: 0 1rem 0 0; }
  .metrics { display: flex; gap: 1.25rem; flex-wrap: wrap; color: #aab; }
  .metrics b { color: #e6e8ee; }
  .spacer { flex: 1; }
  button {
    font: inherit; padding: .35rem .7rem; border-radius: 6px; cursor: pointer;
    border: 1px solid #3a3f4d; background: #262b36; color: #e6e8ee;
  }
  button:hover { background: #313746; }
  button.danger { border-color: #6b2530; background: #3a1c22; color: #ffb3b3; }
  button.danger:hover { background: #4d2029; }
  label.auto { display: inline-flex; align-items: center; gap: .35rem; color: #aab; }
  main { padding: 1.25rem; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid #262b36; }
  th { color: #8b93a7; font-weight: 600; font-size: .8rem; text-transform: uppercase; letter-spacing: .03em; }
  td.id { font-family: ui-monospace, monospace; font-size: .85rem; }
  .badge { padding: .1rem .5rem; border-radius: 999px; font-size: .75rem; }
  .badge.active { background: #123a24; color: #7ee2a8; }
  .badge.gameover { background: #3a2f12; color: #e2c67e; }
  .badge.empty { background: #2a2e3a; color: #8b93a7; }
  .actions { display: flex; gap: .4rem; flex-wrap: wrap; }
  .seat { display: inline-block; margin-right: .4rem; }
  .seat.free { color: #6b7183; }
  .empty-note { color: #8b93a7; padding: 2rem; text-align: center; }
  dialog {
    background: #1c1f28; color: #e6e8ee; border: 1px solid #2a2e3a;
    border-radius: 10px; padding: 1.25rem; max-width: 90vw;
  }
  dialog::backdrop { background: rgba(0,0,0,.6); }
  .grid { display: grid; grid-template-columns: repeat(20, 16px); gap: 1px; margin: .75rem 0; }
  .cell { width: 16px; height: 16px; background: #262b36; border-radius: 2px; }
  .cell.blue { background: #3b82f6; }
  .cell.yellow { background: #eab308; }
  .cell.red { background: #ef4444; }
  .cell.green { background: #22c55e; }
</style>
</head>
<body>
<header>
  <h1>OpenBlokus Admin</h1>
  <div class="metrics" id="metrics"></div>
  <div class="spacer"></div>
  <label class="auto"><input type="checkbox" id="auto" /> Auto-refresh (5s)</label>
  <button id="refresh">Refresh</button>
</header>
<main>
  <table>
    <thead>
      <tr>
        <th>Match ID</th><th>Mode</th><th>Seats</th>
        <th>Created</th><th>Updated</th><th>Status</th><th>Actions</th>
      </tr>
    </thead>
    <tbody id="rows"></tbody>
  </table>
  <div class="empty-note" id="emptyNote" hidden>No matches.</div>
</main>

<dialog id="peek">
  <div id="peekBody"></div>
  <div style="margin-top:1rem;text-align:right"><button id="peekClose">Close</button></div>
</dialog>

<script>
const COLORS = ['blue','yellow','red','green'];

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(path + ' -> ' + res.status);
  return res.status === 204 ? null : res.json();
}

function rel(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.round(s / 60) + 'm ago';
  return Math.round(s / 3600) + 'h ago';
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function loadHealth() {
  const h = await api('/admin/api/health');
  document.getElementById('metrics').innerHTML =
    'Matches <b>' + h.matchCount + '</b>' +
    ' &middot; Uptime <b>' + h.uptimeSec + 's</b>' +
    ' &middot; Memory <b>' + h.memoryMB + ' MB</b>' +
    ' &middot; Storage <b>' + esc(h.storage) + '</b>' +
    ' &middot; Node <b>' + esc(h.node) + '</b>';
}

async function loadMatches() {
  const { matches } = await api('/admin/api/matches');
  const rows = document.getElementById('rows');
  document.getElementById('emptyNote').hidden = matches.length > 0;
  rows.innerHTML = matches.map((m) => {
    const seats = m.seats.map((s) =>
      s.name
        ? '<span class="seat">' + esc(s.name) + (s.connected ? '' : ' ⚪') +
          ' <button data-boot="' + m.matchID + ':' + s.id + '">boot</button></span>'
        : '<span class="seat free">seat ' + s.id + ' free</span>'
    ).join('');
    const mode = m.mode ? m.mode + 'p' + (m.scoring ? ' / ' + esc(m.scoring) : '') : '?';
    return '<tr>' +
      '<td class="id">' + esc(m.matchID) + '</td>' +
      '<td>' + esc(mode) + '</td>' +
      '<td>' + m.filled + '/' + m.total + '<br>' + seats + '</td>' +
      '<td>' + rel(m.createdAt) + '</td>' +
      '<td>' + rel(m.updatedAt) + '</td>' +
      '<td><span class="badge ' + m.status + '">' + m.status + '</span></td>' +
      '<td class="actions">' +
        '<button data-peek="' + m.matchID + '">Peek</button>' +
        '<button class="danger" data-kill="' + m.matchID + '">Kill</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

async function refresh() {
  await Promise.all([loadHealth(), loadMatches()]);
}

async function peek(id) {
  const d = await api('/admin/api/matches/' + encodeURIComponent(id));
  const cells = (d.board || []).map((c) =>
    '<div class="cell ' + (c || '') + '"></div>').join('');
  document.getElementById('peekBody').innerHTML =
    '<h3 style="margin:0 0 .5rem">' + esc(id) + '</h3>' +
    '<div>Current player: <b>' + esc(d.currentPlayer) + '</b>' +
    ' &middot; Turn <b>' + esc(d.turn) + '</b>' +
    ' &middot; Moves <b>' + d.moveCount + '</b>' +
    (d.gameover ? ' &middot; <b>GAME OVER</b>' : '') + '</div>' +
    (d.board ? '<div class="grid">' + cells + '</div>' : '<p>No state yet.</p>');
  document.getElementById('peek').showModal();
}

document.getElementById('rows').addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  try {
    if (t.dataset.peek) { await peek(t.dataset.peek); }
    else if (t.dataset.kill) {
      if (!confirm('Kill match ' + t.dataset.kill + '? This deletes it permanently.')) return;
      await api('/admin/api/matches/' + encodeURIComponent(t.dataset.kill), { method: 'DELETE' });
      await refresh();
    } else if (t.dataset.boot) {
      const [id, seat] = t.dataset.boot.split(':');
      if (!confirm('Boot player from seat ' + seat + '?')) return;
      await api('/admin/api/matches/' + encodeURIComponent(id) + '/boot/' + seat, { method: 'POST' });
      await refresh();
    }
  } catch (err) { alert(err.message); }
});

document.getElementById('refresh').addEventListener('click', () => refresh().catch((e) => alert(e.message)));
document.getElementById('peekClose').addEventListener('click', () => document.getElementById('peek').close());

let timer = null;
document.getElementById('auto').addEventListener('change', (e) => {
  if (timer) { clearInterval(timer); timer = null; }
  if (e.target.checked) timer = setInterval(() => refresh().catch(() => {}), 5000);
});

refresh().catch((e) => alert(e.message));
</script>
</body>
</html>`;
}
