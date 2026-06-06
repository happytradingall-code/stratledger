let trades = [];
let equityChart = null;

function showPage(id) {
document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
document.getElementById(id).classList.add('active');
}

async function loadData() {

const r = await fetch(API_URL);
const rows = await r.json();

trades = rows.slice(1);

const latest = trades[trades.length - 1] || [];

const wins = trades.filter(t => Number(t[6]) > 0).length;
const losses = trades.filter(t => Number(t[6]) < 0).length;

document.getElementById('pnl').innerText =
'₹' + (latest[8] || 0);

document.getElementById('roi').innerText =
((Number(latest[10]) || 0) * 100).toFixed(2) + '%';

document.getElementById('trades').innerText =
trades.length;

document.getElementById('winrate').innerText =
((wins / Math.max(1, (wins + losses))) * 100).toFixed(1) + '%';

document.getElementById('latest').innerHTML =
`Trade ID: ${latest[12] || ''}      <br>PNL: ₹${latest[6] || 0}      <br>${latest[11] || ''}`;

document.getElementById('stats').innerHTML = `     <b>Wins:</b> ${wins}<br>     <b>Losses:</b> ${losses}<br>     <b>Win Rate:</b> ${((wins / Math.max(1, (wins + losses))) * 100).toFixed(1)}%
  `;

let html = '';

[...trades].reverse().forEach(t => {

```
const cls =
  Number(t[6]) >= 0
    ? 'ledger-profit'
    : 'ledger-loss';

html += `
  <div class="card ${cls}">
    <b>${Number(t[6]) >= 0 ? '+' : ''}₹${t[6]}</b><br>

    <div class="small">
      ${String(t[0]).substring(0, 10)}
    </div>

    ${t[1]} • ${t[2]} • ${t[3]}<br>

    ${t[11] || ''}
  </div>
`;
```

});

document.getElementById('ledger').innerHTML = html;

renderEquityChart();
}

function validateForm() {

const ok =
user.value &&
type.value &&
version.value &&
direction.value &&
pnlv.value &&
remarks.value;

saveBtn.disabled = !ok;
}

async function saveTrade() {

const payload = {
date: date.value,
user: user.value,
type: type.value,
version: version.value,
capital: capital.value,
direction: direction.value,
pnl: pnlv.value,
lots: lots.value,
remarks: remarks.value
};

saveBtn.disabled = true;

const r = await fetch(API_URL, {
method: 'POST',
body: JSON.stringify(payload)
});

const res = await r.json();

document.getElementById('msg').innerHTML =
'✅ Trade Saved<br>Trade ID: ' +
(res.tradeId || '');

pnlv.value = '';
remarks.value = '';

await loadData();

saveBtn.disabled = false;
}

window.onload = () => {

date.value =
new Date().toISOString().split('T')[0];

[
'user',
'type',
'version',
'direction',
'pnlv',
'remarks'
].forEach(id => {

```
document
  .getElementById(id)
  .addEventListener('input', validateForm);
```

});

loadData();
};

function renderEquityChart() {

if (typeof Chart === 'undefined') return;

const canvas =
document.getElementById('equityChart');

if (!canvas || !trades.length) return;

const labels =
trades.map((r, i) => i + 1);

const equity =
trades.map(r => Number(r[8]) || 0);

if (equityChart) {
equityChart.destroy();
}

equityChart = new Chart(canvas, {

```
type: 'line',

data: {
  labels: labels,
  datasets: [{
    label: 'Equity Curve',
    data: equity,
    tension: 0.35,
    fill: false
  }]
},

options: {

  responsive: true,

  maintainAspectRatio: false,

  animation: false,

  resizeDelay: 300,

  plugins: {
    legend: {
      display: false
    }
  },

  scales: {

    x: {
      display: false
    },

    y: {
      beginAtZero: false
    }

  }

}
```

});
}
