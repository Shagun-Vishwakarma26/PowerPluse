/**
 * PowerPulse Chart.js Initialization & Helper Module
 */
const PowerPulseCharts = {
  instances: {},

  getChartColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      textColor: isDark ? '#94a3b8' : '#64748b',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      blue: '#3b82f6',
      blueGlow: 'rgba(59, 130, 246, 0.2)',
      emerald: '#10b981',
      amber: '#f59e0b',
      purple: '#8b5cf6',
      cyan: '#06b6d4',
      red: '#ef4444',
      doughnutColors: [
        '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'
      ]
    };
  },

  destroyChart(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },

  // 1. CONSUMPTION TREND LINE CHART
  renderTrendChart(canvasId, labels, data) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const colors = this.getChartColors();

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Electricity Consumption (kWh)',
          data,
          borderColor: colors.blue,
          backgroundColor: colors.blueGlow,
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: colors.blue
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (context) => `Consumption: ${context.raw} kWh`
            }
          }
        },
        scales: {
          x: {
            grid: { color: colors.gridColor },
            ticks: { color: colors.textColor, font: { size: 11 } }
          },
          y: {
            grid: { color: colors.gridColor },
            ticks: {
              color: colors.textColor,
              font: { size: 11 },
              callback: (val) => `${val} kWh`
            }
          }
        }
      }
    });
  },

  // 2. LOCATION CONSUMPTION DOUGHNUT CHART
  renderLocationDoughnut(canvasId, locations) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const colors = this.getChartColors();

    const labels = locations.map(l => l.location);
    const data = locations.map(l => l.consumption);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.doughnutColors.slice(0, locations.length),
          borderWidth: 2,
          borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#141e33' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: colors.textColor, padding: 14, font: { size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const loc = locations[context.dataIndex];
                return `${context.label}: ${context.raw} kWh (${loc.percentage}%)`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  },

  // 3. HOURLY CONSUMPTION BAR CHART
  renderHourlyBarChart(canvasId, hourlyAverages) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const colors = this.getChartColors();
    const labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Average kWh',
          data: hourlyAverages,
          backgroundColor: colors.blue,
          borderRadius: 4,
          hoverBackgroundColor: colors.emerald
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `Hourly Load: ${context.raw} kWh`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.textColor, font: { size: 10 } }
          },
          y: {
            grid: { color: colors.gridColor },
            ticks: {
              color: colors.textColor,
              font: { size: 11 },
              callback: (val) => `${val} kWh`
            }
          }
        }
      }
    });
  },

  // 4. ANALYTICS LOCATION BAR CHART
  renderAnalyticsLocationChart(canvasId, locations) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const colors = this.getChartColors();

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: locations.map(l => l.location),
        datasets: [{
          label: 'Total Consumption (kWh)',
          data: locations.map(l => l.consumption),
          backgroundColor: colors.cyan,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: colors.gridColor }, ticks: { color: colors.textColor } },
          y: { grid: { display: false }, ticks: { color: colors.textColor } }
        }
      }
    });
  },

  // 5. ANALYTICS COST CHART
  renderAnalyticsCostChart(canvasId, labels, costData) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const colors = this.getChartColors();

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Cost (₹)',
          data: costData,
          borderColor: colors.purple,
          backgroundColor: 'rgba(139, 92, 246, 0.15)',
          fill: true,
          tension: 0.3,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: colors.gridColor }, ticks: { color: colors.textColor } },
          y: { grid: { color: colors.gridColor }, ticks: { color: colors.textColor, callback: (v) => `₹${v}` } }
        }
      }
    });
  }
};

window.PowerPulseCharts = PowerPulseCharts;
