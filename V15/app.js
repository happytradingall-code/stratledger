let allTrades = [];   // raw data from sheet — never filtered
let trades = [];      // active dataset (filtered by version)
let activeVersion = 'All';
let equityChart = null;
let allLedgerTrades = [];

// ─── Date helpers (IST-safe) ───
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fixDate(raw) {
  const s = String(raw || '').trim();
  if (s.includes('T')) {
    const d = new Date(s);
    if (!isNaN(d)) {
      const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
      return String(ist.getUTCDate()).padStart(2,'0') + '/' +
             String(ist.getUTCMonth()+1).padStart(2,'0') + '/' +
             ist.getUTCFullYear();
    }
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[3] + '/' + iso[2] + '/' + iso[1];
  const us = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (us) return us[2] + '/' + us[1] + '/' + us[3];
  return s.substring(0, 10);
}

function parseDateParts(raw) {
  const s = String(raw || '').trim();
  if (s.includes('T')) {
    const d = new Date(s);
    if (!isNaN(d)) {
      const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
      return { y: String(ist.getUTCFullYear()), m: String(ist.getUTCMonth()+1).padStart(2,'0'), d: String(ist.getUTCDate()).padStart(2,'0') };
    }
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { y: iso[1], m: iso[2], d: iso[3] };
  const us = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (us) return { y: us[3], m: us[1], d: us[2] };
  return null;
}

function showPage(id, navId) {
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
  if (navId) document.getElementById(navId).classList.add('active');
}

// ─── Format helpers ───
function fmt(n) {
  const v = Number(n);
  return (v >= 0 ? '+' : '-') + '₹' + Math.abs(v).toLocaleString('en-IN');
}
function fmtAbs(n) {
  return '₹' + Math.abs(Number(n)).toLocaleString('en-IN');
}

// ─── Version filter ───
function buildVersionFilter() {
  const versions = [...new Set(allTrades.map(t => (t[3] || '').trim()).filter(Boolean))].sort();
  const bar = document.getElementById('versionFilterBar');
  const btnStyle = `flex-shrink:0;padding:8px 20px;border-radius:20px;border:2px solid #aaaaaa;background:#2a2a2a;color:#ffffff;font-size:13px;font-weight:600;cursor:pointer;font-family:monospace;`;
  const activeBtnStyle = `flex-shrink:0;padding:8px 20px;border-radius:20px;border:2px solid #22d47a;background:#22d47a;color:#000000;font-size:13px;font-weight:600;cursor:pointer;font-family:monospace;`;
  let html = `<button style="${activeVersion === 'All' ? activeBtnStyle : btnStyle}" onclick="setVersion('All')">All</button>`;
  versions.forEach(v => {
    html += `<button style="${activeVersion === v ? activeBtnStyle : btnStyle}" onclick="setVersion('${v}')">${v}</button>`;
  });
  bar.innerHTML = html;
}

function setVersion(v) {
  activeVersion = v;
  trades = v === 'All' ? [...allTrades] : allTrades.filter(t => (t[3] || '').trim() === v);
  buildVersionFilter();
  renderHome();
  renderLedger();
  renderStats();
}

// ─── Load data ───
async function loadData() {
  try {
    const r = await fetch(API_URL);
    const rows = await r.json();
    allTrades = rows.slice(1);
    trades = [...allTrades];
    buildVersionFilter();
    renderHome();
    renderLedger();
    renderStats();
  } catch(e) {
    console.error('Load error', e);
  }
}

function renderHome() {
  const wins = trades.filter(t => Number(t[6]) > 0);
  const losses = trades.filter(t => Number(t[6]) < 0);
  const latest = trades[trades.length - 1] || [];

  const totalPnl = trades.reduce((s, t) => s + (Number(t[6]) || 0), 0);
  const winRate = ((wins.length / Math.max(1, wins.length + losses.length)) * 100).toFixed(1);
  const roi = ((Number(latest[10]) || 0) * 100).toFixed(2);

  document.getElementById('pnl').textContent = '₹' + totalPnl.toLocaleString('en-IN');
  document.getElementById('pnl').style.color = totalPnl >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('winrate').textContent = winRate + '%';
  document.getElementById('roi').textContent = roi + '%';
  document.getElementById('trades').textContent = trades.length;

  const avgWin = wins.length ? wins.reduce((s, t) => s + Number(t[6]), 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + Number(t[6]), 0) / losses.length : 0;
  const pnls = trades.map(t => Number(t[6]) || 0);
  const bestDay = pnls.length ? Math.max(...pnls) : 0;
  const worstDay = pnls.length ? Math.min(...pnls) : 0;

  document.getElementById('avgWin').textContent = avgWin ? '₹' + Math.round(avgWin).toLocaleString('en-IN') : '—';
  document.getElementById('avgLoss').textContent = avgLoss ? '₹' + Math.round(Math.abs(avgLoss)).toLocaleString('en-IN') : '—';
  document.getElementById('bestDay').textContent = bestDay ? '₹' + bestDay.toLocaleString('en-IN') : '—';
  document.getElementById('worstDay').textContent = worstDay ? '₹' + Math.abs(worstDay).toLocaleString('en-IN') : '—';

  let streak = 0, streakDir = '';
  for (let i = trades.length - 1; i >= 0; i--) {
    const p = Number(trades[i][6]);
    if (i === trades.length - 1) { streakDir = p >= 0 ? 'W' : 'L'; streak = 1; }
    else if ((p >= 0 && streakDir === 'W') || (p < 0 && streakDir === 'L')) streak++;
    else break;
  }
  const streakEl = document.getElementById('streak');
  streakEl.textContent = trades.length ? streak + streakDir : '—';
  streakEl.style.color = streakDir === 'W' ? 'var(--green)' : 'var(--red)';

  const rr = avgLoss !== 0 ? (Math.abs(avgWin) / Math.abs(avgLoss)).toFixed(2) : '—';
  document.getElementById('rrRatio').textContent = rr !== '—' ? rr + ':1' : '—';

  if (latest[3]) {
    const cap = Number(latest[4]) || 300000;
    document.getElementById('stratBadge').textContent = latest[3] + ' · ₹' + (cap / 100000).toFixed(0) + 'L';
  }

  if (latest.length) {
    const pnlNum = Number(latest[6]) || 0;
    const isPos = pnlNum >= 0;
    document.getElementById('latest').innerHTML = `
      <div class="latest-pnl ${isPos ? 'pos' : 'neg'}">${fmt(pnlNum)}</div>
      <div class="lc-tags">
        <span class="lc-tag">${fixDate(latest[0])}</span>
        <span class="lc-tag dir-${(latest[5]||'').toLowerCase()}">${latest[5] || ''}</span>
        <span class="lc-tag">${latest[1] || ''}</span>
        <span class="lc-tag">${latest[2] || 'Live'}</span>
        ${latest[12] ? `<span class="lc-tag" style="color:var(--text-muted);font-size:10px">#${latest[12]}</span>` : ''}
      </div>
      ${latest[11] ? `<div class="lc-remarks">${latest[11]}</div>` : ''}
    `;
  } else {
    document.getElementById('latest').textContent = 'No trades yet.';
  }

  if (trades.length >= 2) {
    const last = Number(trades[trades.length-1][8]) || 0;
    const prev = Number(trades[trades.length-2][8]) || 0;
    const diff = last - prev;
    const el = document.getElementById('equityChange');
    el.textContent = fmt(diff);
    el.style.color = diff >= 0 ? 'var(--green)' : 'var(--red)';
  }

  renderEquityChart();
}

function renderLedger(filtered) {
  const list = filtered || [...trades].reverse();
  allLedgerTrades = [...trades].reverse();

  let html = '';
  list.forEach(t => {
    const pnlNum = Number(t[6]) || 0;
    const isPos = pnlNum >= 0;
    const dir = (t[5] || '').toLowerCase();
    html += `
      <div class="ledger-card ${isPos ? 'profit' : 'loss'}">
        <div class="lc-top">
          <span class="lc-pnl ${isPos ? 'pos' : 'neg'}">${fmt(pnlNum)}</span>
          <span class="lc-date">${fixDate(t[0])}</span>
        </div>
        <div class="lc-tags">
          <span class="lc-tag dir-${dir}">${t[5] || ''}</span>
          <span class="lc-tag">${t[1] || ''}</span>
          <span class="lc-tag">${t[2] || 'Live'}</span>
          <span class="lc-tag">${t[3] || ''}</span>
          <span class="lc-tag">${t[7] || '1'} lot${t[7]>1?'s':''}</span>
          ${t[12] ? `<span class="lc-tag" style="font-size:10px">#${t[12]}</span>` : ''}
        </div>
        ${t[11] ? `<div class="lc-remarks">${t[11]}</div>` : ''}
      </div>
    `;
  });

  document.getElementById('ledgerList').innerHTML = html || '<div style="text-align:center;color:var(--text-muted);padding:30px">No trades found</div>';
}

function filterLedger() {
  const q = document.getElementById('ledgerSearch').value.toLowerCase();
  const f = document.getElementById('ledgerFilter').value;
  let list = [...trades].reverse();

  if (f === 'profit') list = list.filter(t => Number(t[6]) > 0);
  if (f === 'loss') list = list.filter(t => Number(t[6]) < 0);
  if (q) list = list.filter(t => JSON.stringify(t).toLowerCase().includes(q));

  renderLedger(list);
}

function renderStats() {
  const wins = trades.filter(t => Number(t[6]) > 0);
  const losses = trades.filter(t => Number(t[6]) < 0);
  const pnls = trades.map(t => Number(t[6]) || 0);
  const totalPnl = pnls.reduce((s, v) => s + v, 0);
  const avgWin = wins.length ? wins.reduce((s, t) => s + Number(t[6]), 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + Number(t[6]), 0) / losses.length) : 0;
  const winRate = ((wins.length / Math.max(1, trades.length)) * 100).toFixed(1);
  const maxDD = computeMaxDD();

  document.getElementById('stats').innerHTML = `
    <div class="stat-item"><div class="stat-label">Total Trades</div><div class="stat-value">${trades.length}</div></div>
    <div class="stat-item"><div class="stat-label">Win Rate</div><div class="stat-value" style="color:var(--green)">${winRate}%</div></div>
    <div class="stat-item"><div class="stat-label">Wins</div><div class="stat-value" style="color:var(--green)">${wins.length}</div></div>
    <div class="stat-item"><div class="stat-label">Losses</div><div class="stat-value" style="color:var(--red)">${losses.length}</div></div>
    <div class="stat-item"><div class="stat-label">Total P&L</div><div class="stat-value" style="color:${totalPnl>=0?'var(--green)':'var(--red)'}}">${fmt(totalPnl)}</div></div>
    <div class="stat-item"><div class="stat-label">Avg Win</div><div class="stat-value" style="color:var(--green)">₹${Math.round(avgWin).toLocaleString('en-IN')}</div></div>
    <div class="stat-item"><div class="stat-label">Avg Loss</div><div class="stat-value" style="color:var(--red)">₹${Math.round(avgLoss).toLocaleString('en-IN')}</div></div>
    <div class="stat-item"><div class="stat-label">Max Drawdown</div><div class="stat-value" style="color:var(--red)">${maxDD}</div></div>
  `;

  renderMonthlyStats();
  renderDistChart();
}

function computeMaxDD() {
  if (!trades.length) return '—';
  let peak = -Infinity, maxDD = 0, running = 0;
  trades.forEach(t => {
    running += Number(t[6]) || 0;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  });
  return '₹' + Math.round(maxDD).toLocaleString('en-IN');
}

function renderMonthlyStats() {
  const monthly = {};
  trades.forEach(t => {
    const parts = parseDateParts(t[0]);
    if (!parts) return;
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const month = monthNames[parseInt(parts.m,10)-1] + ' ' + parts.y;
    if (!monthly[month]) monthly[month] = { trades: 0, pnl: 0, wins: 0, capital: 0 };
    monthly[month].trades++;
    monthly[month].pnl += Number(t[6]) || 0;
    if (Number(t[6]) > 0) monthly[month].wins++;
    const cap = Number(t[4]) || 0;
    if (cap > monthly[month].capital) monthly[month].capital = cap;
  });

  const keys = Object.keys(monthly);
  let html = `
    <div class="monthly-row header">
      <div>Month</div><div>Trades</div><div>P&L</div><div>Win%</div><div>ROI%</div>
    </div>
  `;
  keys.forEach(m => {
    const r = monthly[m];
    const wr = ((r.wins / Math.max(1, r.trades)) * 100).toFixed(0);
    const pos = r.pnl >= 0;
    const roi = r.capital > 0 ? ((r.pnl / r.capital) * 100).toFixed(1) : null;
    const roiHtml = roi !== null
      ? `<div style="color:${pos ? 'var(--green)' : 'var(--red)'};font-weight:600">${pos ? '+' : ''}${roi}%</div>`
      : `<div style="color:var(--text-muted)">—</div>`;
    html += `
      <div class="monthly-row">
        <div>${m}</div>
        <div style="color:var(--text-muted)">${r.trades}</div>
        <div class="monthly-pnl ${pos ? 'pos' : 'neg'}">${pos ? '+' : ''}₹${Math.round(r.pnl).toLocaleString('en-IN')}</div>
        <div style="color:var(--text-muted)">${wr}%</div>
        ${roiHtml}
      </div>
    `;
  });
  document.getElementById('monthlyTable').innerHTML = html;

  const canvas = document.getElementById('monthlyChart');
  if (!canvas) return;
  if (window.monthlyChartObj) window.monthlyChartObj.destroy();
  const values = keys.map(k => Math.round(monthly[k].pnl));
  window.monthlyChartObj = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: keys,
      datasets: [{
        data: values,
        backgroundColor: values.map(v => v >= 0 ? 'rgba(34,212,122,0.6)' : 'rgba(240,82,82,0.6)'),
        borderColor: values.map(v => v >= 0 ? '#22d47a' : '#f05252'),
        borderWidth: 1,
        borderRadius: 5,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#7a8099', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: '#7a8099', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

function renderDistChart() {
  const canvas = document.getElementById('distChart');
  if (!canvas) return;
  if (window.distChartObj) window.distChartObj.destroy();
  const wins = trades.filter(t => Number(t[6]) > 0).length;
  const losses = trades.filter(t => Number(t[6]) < 0).length;
  const breakeven = trades.filter(t => Number(t[6]) === 0).length;
  window.distChartObj = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Wins', 'Losses', 'Breakeven'],
      datasets: [{
        data: [wins, losses, breakeven],
        backgroundColor: ['rgba(34,212,122,0.7)', 'rgba(240,82,82,0.7)', 'rgba(122,128,153,0.4)'],
        borderColor: ['#22d47a', '#f05252', '#7a8099'],
        borderWidth: 1,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#7a8099', font: { size: 11 }, boxWidth: 12, padding: 16 } }
      },
      cutout: '65%'
    }
  });
}

function renderEquityChart() {
  if (typeof Chart === 'undefined' || !trades.length) return;
  const canvas = document.getElementById('equityChart');
  if (!canvas) return;
  if (equityChart) equityChart.destroy();

  const labels = trades.map((_, i) => i + 1);
  const equity = [];
  let running = 0;
  trades.forEach(t => { running += Number(t[6]) || 0; equity.push(running); });

  const isPositive = equity[equity.length - 1] >= 0;
  equityChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: equity,
        tension: 0.4,
        fill: true,
        borderColor: isPositive ? '#22d47a' : '#f05252',
        backgroundColor: isPositive ? 'rgba(34,212,122,0.08)' : 'rgba(240,82,82,0.08)',
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 10,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: {
          beginAtZero: false,
          ticks: { color: '#7a8099', font: { size: 10 }, maxTicksLimit: 4,
            callback: v => '₹' + (v/1000).toFixed(0) + 'k' },
          grid: { color: 'rgba(255,255,255,0.04)' }
        }
      }
    }
  });
}

// ─── Save trade ───
function validateForm() {
  const ok = document.getElementById('user').value &&
             document.getElementById('direction').value &&
             document.getElementById('pnlv').value;
  document.getElementById('saveBtn').disabled = !ok;
}

async function saveTrade() {
  const payload = {
    date: document.getElementById('date').value,
    user: document.getElementById('user').value,
    type: document.getElementById('type').value,
    version: document.getElementById('version').value,
    capital: document.getElementById('capital').value,
    direction: document.getElementById('direction').value,
    pnl: document.getElementById('pnlv').value,
    lots: document.getElementById('lots').value,
    remarks: document.getElementById('remarks').value
  };

  const btn = document.getElementById('saveBtn');
  const btnText = document.getElementById('saveBtnText');
  btn.disabled = true;
  btnText.textContent = 'Saving…';

  try {
    const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
    const res = await r.json();

    document.getElementById('msg').textContent = '✓ Saved · #' + (res.tradeId || '');
    document.getElementById('direction').value = '';
    document.getElementById('pnlv').value = '';
    document.getElementById('lots').value = '1';
    document.getElementById('remarks').value = '';
    btnText.textContent = 'Save Trade';
    validateForm();
    await loadData();

    setTimeout(() => { document.getElementById('msg').textContent = ''; }, 4000);
  } catch(e) {
    document.getElementById('msg').textContent = '✗ Save failed. Try again.';
    document.getElementById('msg').style.color = 'var(--red)';
    btn.disabled = false;
    btnText.textContent = 'Save Trade';
  }
}

// ─── Download Excel ───
function downloadExcel() {
  if (!trades.length) return;

  // Sheet 1: All trades
  const tradeHeaders = ['Date','User','Type','Version','Capital','Direction','P&L','Lots','Equity','','','Remarks','Trade#'];
  const tradeRows = trades.map(t => [
    fixDate(t[0]), t[1]||'', t[2]||'', t[3]||'', Number(t[4])||'',
    t[5]||'', Number(t[6])||0, Number(t[7])||1,
    Number(t[8])||'', '', '', t[11]||'', t[12]||''
  ]);

  // Sheet 2: Monthly summary
  const monthly = {};
  trades.forEach(t => {
    const parts = parseDateParts(t[0]);
    if (!parts) return;
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const month = monthNames[parseInt(parts.m,10)-1] + ' ' + parts.y;
    if (!monthly[month]) monthly[month] = { trades: 0, pnl: 0, wins: 0, capital: 0 };
    monthly[month].trades++;
    monthly[month].pnl += Number(t[6]) || 0;
    if (Number(t[6]) > 0) monthly[month].wins++;
    const cap = Number(t[4]) || 0;
    if (cap > monthly[month].capital) monthly[month].capital = cap;
  });
  const monthHeaders = ['Month','Trades','P&L (₹)','Win %','ROI %'];
  const monthRows = Object.entries(monthly).map(([m, r]) => {
    const wr = ((r.wins / Math.max(1, r.trades)) * 100).toFixed(1);
    const roi = r.capital > 0 ? ((r.pnl / r.capital) * 100).toFixed(2) : '';
    return [m, r.trades, Math.round(r.pnl), parseFloat(wr), roi !== '' ? parseFloat(roi) : ''];
  });

  // Build workbook using SheetJS
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.aoa_to_sheet([tradeHeaders, ...tradeRows]);
  ws1['!cols'] = [10,8,6,8,10,10,10,6,10,0,0,20,8].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws1, 'Trades');

  const ws2 = XLSX.utils.aoa_to_sheet([monthHeaders, ...monthRows]);
  ws2['!cols'] = [12,8,12,8,8].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws2, 'Monthly');

  const version = activeVersion === 'All' ? 'All' : activeVersion;
  const today = todayLocal();
  XLSX.writeFile(wb, `StratLedger_${version}_${today}.xlsx`);
}

// ─── Init ───
window.onload = () => {
  document.getElementById('date').value = todayLocal();
  document.getElementById('type').value = 'Live';
  document.getElementById('version').value = 'V7';
  document.getElementById('capital').value = '300000';
  document.getElementById('lots').value = '1';

  ['user', 'direction', 'pnlv'].forEach(id => {
    document.getElementById(id).addEventListener('input', validateForm);
  });

  validateForm();
  loadData();
};
