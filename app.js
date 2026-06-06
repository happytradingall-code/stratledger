function renderEquityChart() {

  if (typeof Chart === 'undefined') return;

  const canvas = document.getElementById('equityChart');

  if (!canvas || !trades.length) return;

  const totalTrades = trades.length;

  // Mobile-friendly number of labels
  let maxLabels = 5;

  if (window.innerWidth > 768) {
    maxLabels = 8;
  }

  const interval = Math.max(
    1,
    Math.ceil(totalTrades / maxLabels)
  );

  const labels = trades.map((r, i) => {

    const isLast = i === totalTrades - 1;
    const shouldShow = (i % interval === 0) || isLast;

    if (!shouldShow) return '';

    try {

      const d = new Date(r[0]);

      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short'
      });

    } catch {

      return '';
    }

  });

  const equity = trades.map(r =>
    Number(r[8]) || 0
  );

  if (equityChart) {
    equityChart.destroy();
  }

  equityChart = new Chart(canvas, {

    type: 'line',

    data: {

      labels: labels,

      datasets: [{

        label: 'Equity Curve',

        data: equity,

        tension: 0.35,

        fill: false,

        pointRadius: 3,

        pointHoverRadius: 5

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
        },

        tooltip: {

          callbacks: {

            title: function(context) {

              const idx = context[0].dataIndex;

              const d = new Date(trades[idx][0]);

              return d.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              });

            }

          }

        }

      },

      scales: {

        x: {

          display: true,

          offset: true,

          grid: {
            display: false
          },

          ticks: {

            autoSkip: false,

            maxRotation: 0,

            minRotation: 0,

            font: {
              size: 10
            }

          }

        },

        y: {

          beginAtZero: false,

          ticks: {

            callback: function(value) {

              return '₹' +
                Number(value).toLocaleString();

            }

          }

        }

      }

    }

  });

}
