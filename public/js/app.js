/**
 * PowerPulse Main Application Frontend Controller
 */
(function () {
  const App = {
    currentUser: null,
    currentView: 'dashboard',
    activeRegion: 'all',
    readingsState: { page: 1, limit: 10, total: 0, pages: 1, filters: {} },
    trendPeriod: '30days',

    init() {
      this.setupTheme();
      this.setupEventListeners();
      this.checkAuth();
      this.updateCurrentDate();
    },

    // 1. THEME SWITCHER
    setupTheme() {
      const savedTheme = localStorage.getItem('powerpulse_theme') || 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme);
      
      const themeBtn = document.getElementById('theme-toggle-btn');
      if (themeBtn) {
        themeBtn.addEventListener('click', () => {
          const current = document.documentElement.getAttribute('data-theme');
          const next = current === 'dark' ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', next);
          localStorage.setItem('powerpulse_theme', next);
          this.refreshActiveCharts();
        });
      }
    },

    updateCurrentDate() {
      const el = document.getElementById('current-date-display');
      if (el) {
        const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
        el.textContent = new Date().toLocaleDateString('en-US', options);
      }
    },

    // 2. AUTH & ROUTING
    async checkAuth() {
      const token = API.getToken();
      if (!token) {
        this.showLoginView();
        return;
      }

      try {
        const data = await API.getMe();
        if (data.success && data.user) {
          this.currentUser = data.user;
          this.showAppLayout();
        } else {
          this.showLoginView();
        }
      } catch (err) {
        this.showLoginView();
      }
    },

    showLoginView() {
      document.getElementById('auth-container').classList.remove('hidden');
      document.getElementById('app-layout').classList.add('hidden');
      lucide.createIcons();
    },

    showAppLayout() {
      document.getElementById('auth-container').classList.add('hidden');
      document.getElementById('app-layout').classList.remove('hidden');
      this.applyRoleAccess();

      if (this.currentUser) {
        document.getElementById('user-display-name').textContent = this.currentUser.name;
        document.getElementById('user-display-role').textContent = this.currentUser.role;
        document.getElementById('top-user-name').textContent = this.currentUser.name.split(' ')[0];

        const initials = this.currentUser.name
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
        document.getElementById('user-avatar-initials').textContent = initials;
      }

      this.handleHashChange();
      this.updateUnresolvedAlertBadges();
      lucide.createIcons();
    },

    logout() {
      API.setToken(null);
      this.currentUser = null;
      this.showToast('Signed out successfully', 'info');
      this.showLoginView();
    },

    isViewer() {
      return this.currentUser && this.currentUser.role === 'Viewer';
    },

    canManage() {
      return this.currentUser && ['Admin', 'Manager'].includes(this.currentUser.role);
    },

    applyRoleAccess() {
      const role = this.currentUser && this.currentUser.role;
      document.querySelectorAll('[data-roles]').forEach(element => {
        const allowedRoles = element.getAttribute('data-roles').split(',');
        element.classList.toggle('hidden', !allowedRoles.includes(role));
      });
    },

    // 3. TOAST NOTIFICATION UTILITY
    showToast(message, type = 'info') {
      const container = document.getElementById('toast-container');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;

      let iconName = 'info';
      if (type === 'success') iconName = 'check-circle';
      if (type === 'error') iconName = 'alert-octagon';
      if (type === 'warning') iconName = 'alert-triangle';

      toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <span>${message}</span>
      `;

      container.appendChild(toast);
      lucide.createIcons();

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    },

    // 4. NAVIGATION & SPA ROUTER
    setupEventListeners() {
      window.addEventListener('hashchange', () => this.handleHashChange());

      document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
        link.addEventListener('click', () => {
          const targetView = link.getAttribute('data-view');
          if (targetView) {
            window.location.hash = targetView;
          }
        });
      });

      const toggleBtn = document.getElementById('sidebar-toggle-btn');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          document.getElementById('sidebar').classList.toggle('collapsed');
          setTimeout(() => this.refreshActiveCharts(), 300);
        });
      }

      const mobileBtn = document.getElementById('mobile-menu-btn');
      const backdrop = document.getElementById('drawer-backdrop');
      if (mobileBtn && backdrop) {
        mobileBtn.addEventListener('click', () => {
          document.getElementById('sidebar').classList.add('mobile-open');
          backdrop.classList.add('active');
        });
        backdrop.addEventListener('click', () => {
          document.getElementById('sidebar').classList.remove('mobile-open');
          backdrop.classList.remove('active');
        });
      }

      // REGIONAL FILTER PILLS HANDLER
      document.querySelectorAll('.region-filter-bar .pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.region-filter-bar .pill-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.activeRegion = btn.getAttribute('data-region');
          this.loadDashboardData();
        });
      });

      const formLogin = document.getElementById('login-form');

      document.querySelectorAll('[data-login-role]').forEach(button => {
        button.addEventListener('click', () => {
          document.querySelectorAll('[data-login-role]').forEach(option => {
            const selected = option === button;
            option.classList.toggle('active', selected);
            option.setAttribute('aria-pressed', selected);
          });
          document.getElementById('login-role').value = button.dataset.loginRole;
        });
      });

      if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
          e.preventDefault();
          const email = document.getElementById('login-email').value;
          const password = document.getElementById('login-password').value;
          const role = document.getElementById('login-role').value;

          try {
            const data = await API.login(email, password, role);
            if (data.success) {
              this.currentUser = data.user;
              this.showToast(`Welcome back, ${data.user.name}!`, 'success');
              this.showAppLayout();
            }
          } catch (err) {
            this.showToast(err.message || 'Login failed', 'error');
          }
        });
      }

      const togglePwBtn = document.getElementById('toggle-pw-btn');
      if (togglePwBtn) {
        togglePwBtn.addEventListener('click', () => {
          const input = document.getElementById('login-password');
          input.type = input.type === 'password' ? 'text' : 'password';
        });
      }

      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());

      document.querySelectorAll('#trend-timeframe-btns .btn-timeframe').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#trend-timeframe-btns .btn-timeframe').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.trendPeriod = btn.getAttribute('data-period');
          this.loadDashboardTrend();
        });
      });

      const notifBtn = document.getElementById('notification-btn');
      const popover = document.getElementById('notification-popover');
      if (notifBtn && popover) {
        notifBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          popover.classList.toggle('hidden');
        });
        document.addEventListener('click', () => popover.classList.add('hidden'));
      }

      const searchInput = document.getElementById('global-search-input');
      const searchDropdown = document.getElementById('search-results-dropdown');
      if (searchInput && searchDropdown) {
        searchInput.addEventListener('input', async (e) => {
          const val = e.target.value.trim();
          if (val.length < 2) {
            searchDropdown.classList.add('hidden');
            return;
          }

          try {
            const res = await API.getReadings({ search: val, limit: 5 });
            searchDropdown.innerHTML = '';
            if (res.readings && res.readings.length > 0) {
              res.readings.forEach(r => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `
                  <strong>${r.location} (${r.meterId})</strong>
                  <span class="text-muted">${r.date} ${r.time} - ${r.consumption} kWh (₹${r.cost})</span>
                `;
                item.addEventListener('click', () => {
                  searchDropdown.classList.add('hidden');
                  window.location.hash = 'readings';
                });
                searchDropdown.appendChild(item);
              });
              searchDropdown.classList.remove('hidden');
            } else {
              searchDropdown.innerHTML = '<div class="search-result-item text-muted">No matching results found</div>';
              searchDropdown.classList.remove('hidden');
            }
          } catch (err) {
            console.error(err);
          }
        });
      }

      document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
        });
      });

      this.setupReadingsEventListeners();
      this.setupLocationsEventListeners();
      this.setupAlertsEventListeners();
      this.setupReportsEventListeners();
      this.setupSettingsEventListeners();
      this.setupUsersEventListeners();
    },

    handleHashChange() {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      const roleViews = {
        Admin: ['dashboard', 'readings', 'analytics', 'locations', 'alerts', 'users', 'reports', 'settings'],
        Manager: ['dashboard', 'readings', 'analytics', 'locations', 'alerts', 'reports'],
        Viewer: ['dashboard', 'readings', 'analytics', 'locations', 'reports']
      };
      const allowedViews = roleViews[this.currentUser && this.currentUser.role] || [];
      if (!allowedViews.includes(hash)) {
        window.location.hash = 'dashboard';
        return;
      }
      this.currentView = hash;

      document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
        if (link.getAttribute('data-view') === hash) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });

      const titleMap = {
        dashboard: 'Dashboard Overview',
        readings: 'Electricity Readings',
        analytics: 'Advanced Analytics',
        locations: 'Locations & Meters',
        alerts: 'Alert Center',
        users: 'User Management',
        reports: 'Energy Audit Reports',
        settings: 'System Settings'
      };

      document.getElementById('current-page-title').textContent = titleMap[hash] || 'Dashboard';

      document.querySelectorAll('.page-view').forEach(view => {
        if (view.id === `view-${hash}`) {
          view.classList.add('active');
        } else {
          view.classList.remove('active');
        }
      });

      document.getElementById('sidebar').classList.remove('mobile-open');
      const backdrop = document.getElementById('drawer-backdrop');
      if (backdrop) backdrop.classList.remove('active');

      this.loadViewData(hash);
    },

    async loadViewData(view) {
      switch (view) {
        case 'dashboard':
          await this.loadDashboardData();
          break;
        case 'readings':
          await this.loadReadingsView();
          break;
        case 'analytics':
          await this.loadAnalyticsView();
          break;
        case 'locations':
          await this.loadLocationsView();
          break;
        case 'alerts':
          await this.loadAlertsView();
          break;
        case 'users':
          await this.loadUsersView();
          break;
        case 'reports':
          await this.loadReportsView();
          break;
        case 'settings':
          await this.loadSettingsView();
          break;
      }
      lucide.createIcons();
    },

    refreshActiveCharts() {
      if (this.currentView === 'dashboard') {
        this.loadDashboardData();
      } else if (this.currentView === 'analytics') {
        this.loadAnalyticsView();
      }
    },

    async updateUnresolvedAlertBadges() {
      try {
        const popList = document.getElementById('popover-alert-list');
        const popHeading = document.querySelector('.notification-popover .popover-header h4');
        const viewAllLink = document.querySelector('.view-all-alerts-link');

        if (this.currentUser && this.currentUser.role === 'Viewer') {
          const res = await API.getReadings({ limit: 50 });
          const readings = res.readings || [];
          const count = readings.length;

          if (popHeading) popHeading.textContent = 'Electricity Consumption';
          if (viewAllLink) viewAllLink.classList.add('hidden');

          const navBadge = document.getElementById('nav-alert-badge');
          const sidebarBadge = document.getElementById('sidebar-alert-count');
          if (navBadge) navBadge.textContent = count;
          if (sidebarBadge) sidebarBadge.textContent = '0';

          if (popList) {
            popList.innerHTML = '';
            if (readings.length === 0) {
              popList.textContent = 'No electricity consumption recorded';
            } else {
              readings.slice(0, 4).forEach(reading => {
                const item = document.createElement('div');
                item.className = 'popover-alert-item';

                const consumption = document.createElement('strong');
                consumption.textContent = `${reading.consumption} kWh electricity consumption`;
                item.append(consumption);
                popList.appendChild(item);
              });
            }
          }
          return;
        }

        if (popHeading) popHeading.textContent = 'Unresolved Alerts';
        if (viewAllLink) viewAllLink.classList.remove('hidden');
        const res = await API.getAlerts({ status: 'New' });
        const count = res.unresolvedCount || 0;

        const navBadge = document.getElementById('nav-alert-badge');
        const sidebarBadge = document.getElementById('sidebar-alert-count');

        if (navBadge) navBadge.textContent = count;
        if (sidebarBadge) sidebarBadge.textContent = count;

        if (popList && res.alerts) {
          popList.innerHTML = '';
          if (res.alerts.length === 0) {
            popList.innerHTML = '<p class="text-muted text-center" style="font-size:0.8rem;">No unresolved alerts</p>';
          } else {
            res.alerts.slice(0, 4).forEach(a => {
              const div = document.createElement('div');
              div.className = 'popover-alert-item';
              div.innerHTML = `
                <strong class="text-danger">${a.type}</strong>
                <div>${a.location} - ${a.consumption} kWh</div>
              `;
              popList.appendChild(div);
            });
          }
        }
      } catch (err) {
        console.error(err);
      }
    },

    // ==========================================
    // 5. DASHBOARD CONTROLLER (REGION AWARE)
    // ==========================================
    async loadDashboardData() {
      try {
        const sumRes = await API.getAnalyticsSummary(this.trendPeriod);
        if (sumRes.success && sumRes.summary) {
          let s = sumRes.summary;

          // If a specific region pill is selected, filter numbers proportionally for clean demo view
          if (this.activeRegion !== 'all') {
            s = {
              ...s,
              totalConsumption: Math.round(s.totalConsumption / 7),
              avgConsumption: Math.round(s.avgConsumption / 7),
              totalCost: Math.round(s.totalCost / 7),
              co2EmissionTonnes: Math.round((s.co2EmissionTonnes / 7) * 10) / 10,
              treesEquivalent: Math.round(s.treesEquivalent / 7),
              projectedMonthlyCost: Math.round(s.projectedMonthlyCost / 7)
            };
          }

          document.getElementById('kpi-total-consumption').textContent = `${s.totalConsumption.toLocaleString()} kWh`;
          document.getElementById('kpi-avg-consumption').textContent = `${s.avgConsumption.toLocaleString()} kWh/day`;
          document.getElementById('kpi-peak-consumption').textContent = `${s.peakConsumption.toLocaleString()} kWh`;
          document.getElementById('kpi-total-cost').textContent = `₹${s.totalCost.toLocaleString()}`;
          document.getElementById('kpi-active-meters').textContent = this.activeRegion === 'all' ? s.activeMetersCount : 2;
          document.getElementById('kpi-active-alerts').textContent = s.activeAlertsCount;
          document.getElementById('kpi-total-pct').textContent = s.consumptionChangePct;

          if (document.getElementById('sust-co2')) {
            document.getElementById('sust-co2').textContent = `${s.co2EmissionTonnes} Tonnes`;
            document.getElementById('sust-trees').textContent = `${s.treesEquivalent.toLocaleString()} Trees`;
            document.getElementById('sust-forecast').textContent = `₹${s.projectedMonthlyCost.toLocaleString()}`;
          }
        }

        await this.loadDashboardTrend();

        const locRes = await API.getLocationWise();
        if (locRes.success && locRes.locations) {
          PowerPulseCharts.renderLocationDoughnut('locationDoughnutChart', locRes.locations);
        }

        const hrRes = await API.getHourly();
        if (hrRes.success) {
          PowerPulseCharts.renderHourlyBarChart('hourlyBarChart', hrRes.hourlyAverages);
          document.getElementById('highest-hour-text').textContent = `${hrRes.highestHour.timeRange} (${hrRes.highestHour.consumption} kWh)`;
          document.getElementById('lowest-hour-text').textContent = `${hrRes.lowestHour.timeRange} (${hrRes.lowestHour.consumption} kWh)`;
          document.getElementById('avg-hour-text').textContent = `${hrRes.averageHourly} kWh`;
        }

        const insRes = await API.getInsights();
        if (insRes.success && insRes.insights) {
          const container = document.getElementById('insights-container');
          container.innerHTML = '';
          insRes.insights.forEach(item => {
            const div = document.createElement('div');
            div.className = 'insight-item';
            div.innerHTML = `
              <div class="insight-icon-wrap icon-${item.type === 'critical' ? 'red' : item.type === 'warning' ? 'amber' : 'emerald'}">
                <i data-lucide="${item.icon}"></i>
              </div>
              <div>
                <h4 class="insight-title">${item.title}</h4>
                <p class="insight-desc">${item.message}</p>
              </div>
            `;
            container.appendChild(div);
          });
        }

        const readingParams = { limit: 5 };
        if (this.activeRegion !== 'all') readingParams.location = this.activeRegion;
        const rdRes = await API.getReadings(readingParams);

        const tbody = document.getElementById('dash-recent-readings-tbody');
        if (tbody && rdRes.readings) {
          tbody.innerHTML = '';
          rdRes.readings.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td>${r.date} ${r.time}</td>
              <td><strong>${r.location}</strong></td>
              <td><code>${r.meterId}</code></td>
              <td><strong>${r.consumption} kWh</strong></td>
              <td>₹${r.cost}</td>
              <td><span class="badge badge-success">${r.readingType}</span></td>
            `;
            tbody.appendChild(tr);
          });
        }

        if (!this.isViewer()) {
          const alRes = await API.getAlerts({ status: 'New' });
          const alertBox = document.getElementById('dash-recent-alerts-list');
          if (alertBox && alRes.alerts) {
            alertBox.innerHTML = '';
            if (alRes.alerts.length === 0) {
              alertBox.innerHTML = '<p class="text-muted">No unresolved alerts! All systems normal.</p>';
            } else {
              alRes.alerts.slice(0, 4).forEach(a => {
                const div = document.createElement('div');
                div.className = 'insight-item';
                div.innerHTML = `
                  <div class="insight-icon-wrap icon-red">
                    <i data-lucide="alert-triangle"></i>
                  </div>
                  <div style="flex:1;">
                    <h4 class="insight-title">${a.type} (${a.severity})</h4>
                    <p class="insight-desc">${a.message}</p>
                  </div>
                  <button class="btn btn-sm btn-outline" onclick="window.powerPulseApp.resolveAlertQuick('${a._id}')">Resolve</button>
                `;
                alertBox.appendChild(div);
              });
            }
          }
        }

      } catch (err) {
        console.error('Error loading dashboard data:', err);
      }
    },

    async loadDashboardTrend() {
      const res = await API.getTrend(this.trendPeriod);
      if (res.success && res.labels && res.data) {
        PowerPulseCharts.renderTrendChart('trendChart', res.labels, res.data);
      }
    },

    async resolveAlertQuick(id) {
      try {
        await API.updateAlertStatus(id, 'Resolved');
        this.showToast('Alert resolved', 'success');
        this.loadDashboardData();
        this.updateUnresolvedAlertBadges();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    },

    // ==========================================
    // 6. ELECTRICITY READINGS CONTROLLER
    // ==========================================
    setupReadingsEventListeners() {
      document.getElementById('btn-add-reading').addEventListener('click', () => {
        this.openReadingModal();
      });

      const applyFilters = () => {
        this.readingsState.page = 1;
        this.loadReadingsTable();
      };

      document.getElementById('filter-search').addEventListener('input', applyFilters);
      document.getElementById('filter-location').addEventListener('change', applyFilters);
      document.getElementById('filter-meter').addEventListener('change', applyFilters);
      document.getElementById('filter-reading-type').addEventListener('change', applyFilters);
      document.getElementById('filter-start-date').addEventListener('change', applyFilters);
      document.getElementById('filter-end-date').addEventListener('change', applyFilters);

      document.getElementById('btn-reset-filters').addEventListener('click', () => {
        document.getElementById('filter-search').value = '';
        document.getElementById('filter-location').value = 'all';
        document.getElementById('filter-meter').value = 'all';
        document.getElementById('filter-reading-type').value = 'all';
        document.getElementById('filter-start-date').value = '';
        document.getElementById('filter-end-date').value = '';
        applyFilters();
      });

      document.getElementById('btn-prev-page').addEventListener('click', () => {
        if (this.readingsState.page > 1) {
          this.readingsState.page--;
          this.loadReadingsTable();
        }
      });

      document.getElementById('btn-next-page').addEventListener('click', () => {
        if (this.readingsState.page < this.readingsState.pages) {
          this.readingsState.page++;
          this.loadReadingsTable();
        }
      });

      document.getElementById('form-reading').addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = document.getElementById('reading-edit-id').value;
        const location = document.getElementById('rd-location').value;
        const meterId = document.getElementById('rd-meter').value;
        const date = document.getElementById('rd-date').value;
        const time = document.getElementById('rd-time').value;
        const consumption = parseFloat(document.getElementById('rd-consumption').value);
        const cost = parseFloat(document.getElementById('rd-cost').value);
        const readingType = document.getElementById('rd-type').value;
        const notes = document.getElementById('rd-notes').value;

        if (!location || !meterId || !date || !time || isNaN(consumption) || consumption < 0) {
          this.showToast('Please fill all required fields correctly. Consumption must be non-negative.', 'error');
          return;
        }

        const payload = { location, meterId, date, time, consumption, cost, readingType, notes };

        try {
          let res;
          if (editId) {
            res = await API.updateReading(editId, payload);
            this.showToast('Reading updated successfully', 'success');
          } else {
            res = await API.createReading(payload);
            this.showToast('Reading added successfully', 'success');
            if (res.alertTriggered && res.alert) {
              this.showToast(`ALERT: ${res.alert.type} triggered for ${res.alert.location}!`, 'warning');
            }
          }

          document.getElementById('modal-reading').classList.add('hidden');
          this.loadReadingsTable();
          this.updateUnresolvedAlertBadges();
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });

      const importBtn = document.getElementById('btn-import-csv');
      const exportBtn = document.getElementById('btn-export-csv');

      if (importBtn) {
        importBtn.addEventListener('click', () => {
          document.getElementById('modal-csv-import').classList.remove('hidden');
        });
      }

      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          const loc = document.getElementById('filter-location').value;
          const mtr = document.getElementById('filter-meter').value;
          API.downloadCSV({ location: loc, meterId: mtr }).catch(err => this.showToast(err.message, 'error'));
        });
      }

      const csvInput = document.getElementById('csv-file-input');
      if (csvInput) {
        csvInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (file) this.processCSVFile(file);
        });
      }

      const confirmImportBtn = document.getElementById('btn-confirm-csv-import');
      if (confirmImportBtn) {
        confirmImportBtn.addEventListener('click', async () => {
          if (!this.parsedCSVRows || this.parsedCSVRows.length === 0) return;
          try {
            const res = await API.importCSV(this.parsedCSVRows);
            this.showToast(res.message, 'success');
            document.getElementById('modal-csv-import').classList.add('hidden');
            this.loadReadingsTable();
            this.updateUnresolvedAlertBadges();
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        });
      }
    },

    async loadReadingsView() {
      await this.populateLocationAndMeterDropdowns();
      await this.loadReadingsTable();
    },

    async populateLocationAndMeterDropdowns() {
      try {
        const locRes = await API.getLocations();
        const mtrRes = await API.getMeters();

        const filterLoc = document.getElementById('filter-location');
        const filterMtr = document.getElementById('filter-meter');

        if (filterLoc && locRes.locations) {
          const curr = filterLoc.value;
          filterLoc.innerHTML = '<option value="all">All Locations</option>';
          locRes.locations.forEach(l => {
            filterLoc.innerHTML += `<option value="${l.name}">${l.name}</option>`;
          });
          filterLoc.value = curr || 'all';
        }

        if (filterMtr && mtrRes.meters) {
          const curr = filterMtr.value;
          filterMtr.innerHTML = '<option value="all">All Meters</option>';
          mtrRes.meters.forEach(m => {
            filterMtr.innerHTML += `<option value="${m.meterId}">${m.meterId} (${m.location})</option>`;
          });
          filterMtr.value = curr || 'all';
        }

        const modalLoc = document.getElementById('rd-location');
        const modalMtr = document.getElementById('rd-meter');
          const meterOwnerSelect = document.getElementById('mtr-owner');

        if (modalLoc && locRes.locations) {
          modalLoc.innerHTML = '';
          locRes.locations.forEach(l => {
            modalLoc.innerHTML += `<option value="${l.name}">${l.name}</option>`;
          });
        }

        if (modalMtr && mtrRes.meters) {
          modalMtr.innerHTML = '';
          mtrRes.meters.forEach(m => {
            modalMtr.innerHTML += `<option value="${m.meterId}">${m.meterId} (${m.location})</option>`;
          });
        }
        if (meterOwnerSelect && this.canManage()) {
          const viewersRes = await API.getViewers();
          meterOwnerSelect.innerHTML = '<option value="">Unassigned</option>';
          (viewersRes.viewers || []).forEach(viewer => {
            meterOwnerSelect.innerHTML += `<option value="${viewer._id}">${viewer.name} (${viewer.email})</option>`;
          });
        }

      } catch (err) {
        console.error(err);
      }
    },

    async loadReadingsTable() {
      const search = document.getElementById('filter-search').value;
      const location = document.getElementById('filter-location').value;
      const meterId = document.getElementById('filter-meter').value;
      const readingType = document.getElementById('filter-reading-type').value;
      const startDate = document.getElementById('filter-start-date').value;
      const endDate = document.getElementById('filter-end-date').value;

      const params = {
        page: this.readingsState.page,
        limit: this.readingsState.limit,
        search, location, meterId, readingType, startDate, endDate
      };

      try {
        const res = await API.getReadings(params);
        const tbody = document.getElementById('readings-tbody');
        const emptyState = document.getElementById('readings-empty-state');

        tbody.innerHTML = '';

        if (!res.readings || res.readings.length === 0) {
          emptyState.classList.remove('hidden');
        } else {
          emptyState.classList.add('hidden');
          res.readings.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td><strong>${r.date}</strong> ${r.time}</td>
              <td>${r.location}</td>
              <td><code>${r.meterId}</code></td>
              <td><strong>${r.consumption} kWh</strong></td>
              <td>₹${r.cost}</td>
              <td><span class="badge badge-success">${r.readingType}</span></td>
              <td>${r.notes || '-'}</td>
              ${this.canManage() ? `<td>
                  <button class="btn btn-sm btn-outline" onclick="window.powerPulseApp.editReading('${r._id}')"><i data-lucide="edit"></i> Edit</button>
                  <button class="btn btn-sm btn-outline text-danger" onclick="window.powerPulseApp.deleteReading('${r._id}')"><i data-lucide="trash-2"></i></button>
                </td>` : ''}
            `;
            tbody.appendChild(tr);
          });
        }

        this.readingsState.total = res.total || 0;
        this.readingsState.pages = res.pages || 1;

        document.getElementById('readings-pagination-info').textContent =
          `Showing ${res.count || 0} of ${res.total || 0} readings`;
        document.getElementById('current-page-num').textContent = this.readingsState.page;

        document.getElementById('btn-prev-page').disabled = this.readingsState.page <= 1;
        document.getElementById('btn-next-page').disabled = this.readingsState.page >= this.readingsState.pages;

        lucide.createIcons();

      } catch (err) {
        this.showToast(err.message, 'error');
      }
    },

    async openReadingModal(reading = null) {
      await this.populateLocationAndMeterDropdowns();
      const modal = document.getElementById('modal-reading');
      const form = document.getElementById('form-reading');
      form.reset();

      if (reading) {
        document.getElementById('modal-reading-title').textContent = 'Edit Electricity Reading';
        document.getElementById('reading-edit-id').value = reading._id;
        document.getElementById('rd-location').value = reading.location;
        document.getElementById('rd-meter').value = reading.meterId;
        document.getElementById('rd-date').value = reading.date;
        document.getElementById('rd-time').value = reading.time;
        document.getElementById('rd-consumption').value = reading.consumption;
        document.getElementById('rd-cost').value = reading.cost;
        document.getElementById('rd-type').value = reading.readingType;
        document.getElementById('rd-notes').value = reading.notes || '';
      } else {
        document.getElementById('modal-reading-title').textContent = 'Add Electricity Reading';
        document.getElementById('reading-edit-id').value = '';
        const today = new Date().toISOString().split('T')[0];
        const nowTime = new Date().toTimeString().slice(0, 5);
        document.getElementById('rd-date').value = today;
        document.getElementById('rd-time').value = nowTime;
      }

      modal.classList.remove('hidden');
    },

    async editReading(id) {
      try {
        const res = await API.request(`/readings/${id}`);
        if (res.reading) this.openReadingModal(res.reading);
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    },

    async deleteReading(id) {
      if (!confirm('Are you sure you want to delete this electricity reading?')) return;
      try {
        await API.deleteReading(id);
        this.showToast('Reading deleted successfully', 'success');
        this.loadReadingsTable();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    },

    processCSVFile(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2) {
          this.showToast('Invalid CSV file header structure', 'error');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length >= 4) {
            const rowObj = {};
            headers.forEach((h, idx) => {
              rowObj[h] = cols[idx] || '';
            });
            rows.push(rowObj);
          }
        }

        this.parsedCSVRows = rows;
        this.renderCSVPreview(rows);
      };
      reader.readAsText(file);
    },

    renderCSVPreview(rows) {
      const previewContainer = document.getElementById('csv-preview-container');
      const tbody = document.getElementById('csv-preview-tbody');
      const validLabel = document.getElementById('csv-valid-count');
      const invalidLabel = document.getElementById('csv-invalid-count');
      const confirmBtn = document.getElementById('btn-confirm-csv-import');

      tbody.innerHTML = '';
      let validCount = 0;
      let invalidCount = 0;

      rows.forEach(r => {
        const date = r.date || r.Date;
        const time = r.time || r.Time || '12:00';
        const location = r.location || r.Location;
        const meter = r.meterId || r.MeterId || r['Meter ID'];
        const consumption = parseFloat(r.consumption || r.Consumption);
        const cost = parseFloat(r.cost || r.Cost);

        const isValid = location && meter && date && !isNaN(consumption) && consumption >= 0;
        if (isValid) validCount++; else invalidCount++;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${date}</td>
          <td>${time}</td>
          <td>${location}</td>
          <td>${meter}</td>
          <td>${isNaN(consumption) ? 'INVALID' : consumption + ' kWh'}</td>
          <td>${isNaN(cost) ? 'Auto' : '₹' + cost}</td>
          <td><span class="badge ${isValid ? 'badge-success' : 'badge-danger'}">${isValid ? 'Valid' : 'Invalid'}</span></td>
        `;
        tbody.appendChild(tr);
      });

      validLabel.textContent = `Valid rows: ${validCount}`;
      invalidLabel.textContent = `Invalid rows: ${invalidCount}`;
      confirmBtn.disabled = validCount === 0;

      previewContainer.classList.remove('hidden');
    },

    // ==========================================
    // 7. ANALYTICS CONTROLLER
    // ==========================================
    async loadAnalyticsView() {
      try {
        const sum = await API.getAnalyticsSummary('30days');
        if (sum.success && sum.summary) {
          const s = sum.summary;
          document.getElementById('analytics-total').textContent = `${s.totalConsumption.toLocaleString()} kWh`;
          document.getElementById('analytics-avg').textContent = `${s.avgConsumption.toLocaleString()} kWh/day`;
          document.getElementById('analytics-peak').textContent = `${s.peakConsumption.toLocaleString()} kWh`;
          document.getElementById('analytics-cost-total').textContent = `₹${s.totalCost.toLocaleString()}`;
        }

        const locRes = await API.getLocationWise();
        if (locRes.success && locRes.locations) {
          PowerPulseCharts.renderAnalyticsLocationChart('analyticsLocationChart', locRes.locations);
        }

        const trendRes = await API.getTrend('30days');
        if (trendRes.success && trendRes.labels && trendRes.data) {
          const costData = trendRes.data.map(kwh => Math.round(kwh * 8.5));
          PowerPulseCharts.renderAnalyticsCostChart('analyticsCostChart', trendRes.labels, costData);
        }
      } catch (err) {
        console.error(err);
      }
    },

    // ==========================================
    // 8. LOCATIONS & METERS CONTROLLER
    // ==========================================
    setupLocationsEventListeners() {
      document.getElementById('btn-add-location').addEventListener('click', () => {
        document.getElementById('form-location').reset();
        document.getElementById('loc-edit-id').value = '';
        document.getElementById('modal-location-title').textContent = 'Add New Location';
        document.getElementById('modal-location').classList.remove('hidden');
      });

      document.getElementById('btn-add-meter').addEventListener('click', async () => {
        await this.populateLocationAndMeterDropdowns();
        document.getElementById('form-meter').reset();
        document.getElementById('meter-edit-id').value = '';
        document.getElementById('modal-meter-title').textContent = 'Add Electricity Meter';
        document.getElementById('modal-meter').classList.remove('hidden');
      });

      document.getElementById('form-location').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('loc-edit-id').value;
        const city = document.getElementById('loc-city').value.trim();
        const region = document.getElementById('loc-region').value.trim();
        const name = document.getElementById('loc-name').value.trim() || (city && region ? `${city} - ${region}` : city || region);
        const address = document.getElementById('loc-address').value.trim();
        const status = document.getElementById('loc-status').value;

        try {
          if (!city || !region) {
            throw new Error('City and region are required for a location');
          }

          if (id) {
            await API.updateLocation(id, { name, city, region, address, status });
            this.showToast('Location updated', 'success');
          } else {
            await API.createLocation({ name, city, region, address, status });
            this.showToast('Location created', 'success');
          }
          document.getElementById('modal-location').classList.add('hidden');
          this.loadLocationsView();
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });

      document.getElementById('form-meter').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('meter-edit-id').value;
        const meterId = document.getElementById('mtr-id').value;
        const location = document.getElementById('mtr-location').value;
        const type = document.getElementById('mtr-type').value;
        const currentReading = parseFloat(document.getElementById('mtr-initial').value);
        const status = document.getElementById('mtr-status').value;
        const ownerId = document.getElementById('mtr-owner').value || null;

        try {
          if (id) {
            await API.updateMeter(id, { meterId, location, type, currentReading, status, ownerId });
            this.showToast('Meter updated', 'success');
          } else {
            await API.createMeter({ meterId, location, type, currentReading, status, ownerId });
            this.showToast('Meter created', 'success');
          }
          document.getElementById('modal-meter').classList.add('hidden');
          this.loadLocationsView();
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    },

    async loadLocationsView() {
      try {
        const locRes = await API.getLocations();
        const grid = document.getElementById('locations-grid');
        grid.innerHTML = '';

        if (locRes.locations) {
          locRes.locations.forEach(loc => {
            const badgeClass = loc.status === 'Active' ? 'badge-success' : loc.status === 'Warning' ? 'badge-warning' : 'badge-danger';
            const cityText = loc.city ? `${loc.city}` : '';
            const regionText = loc.region ? ` • ${loc.region}` : '';
            const card = document.createElement('div');
            card.className = 'location-card';
            card.innerHTML = `
              <div>
                <div class="loc-card-header">
                  <div>
                    <h4 class="loc-name">${loc.name}</h4>
                    <p class="loc-address">${cityText}${regionText}${loc.address ? ` • ${loc.address}` : ''}</p>
                  </div>
                  <span class="badge ${badgeClass}">${loc.status}</span>
                </div>
                <div class="loc-card-stats">
                  <div class="loc-stat-item">
                    <span class="loc-stat-val">${loc.meterCount}</span>
                    <span class="loc-stat-lbl">Meters</span>
                  </div>
                  <div class="loc-stat-item">
                    <span class="loc-stat-val text-blue">${loc.totalConsumption} kWh</span>
                    <span class="loc-stat-lbl">Total Usage</span>
                  </div>
                </div>
              </div>
              ${this.canManage() ? `<div class="filter-actions mt-2">
                  <button class="btn btn-sm btn-outline" onclick="window.powerPulseApp.editLocation('${loc._id}')">Edit</button>
                  <button class="btn btn-sm btn-outline text-danger" onclick="window.powerPulseApp.deleteLocation('${loc._id}')">Delete</button>
                </div>` : ''}
            `;
            grid.appendChild(card);
          });
        }

        const mtrRes = await API.getMeters();
        const tbody = document.getElementById('meters-tbody');
        tbody.innerHTML = '';

        if (mtrRes.meters) {
          mtrRes.meters.forEach(m => {
            const badgeClass = m.status === 'Active' ? 'badge-success' : m.status === 'Warning' ? 'badge-warning' : 'badge-danger';
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td><code>${m.meterId}</code></td>
              <td>${m.location}</td>
              <td>${m.type}</td>
              <td><strong>${m.currentReading} kWh</strong></td>
              <td>${m.ownerId ? m.ownerId.name : 'Unassigned'}</td>
              <td><span class="badge ${badgeClass}">${m.status}</span></td>
              <td>${new Date(m.lastUpdated).toLocaleString()}</td>
              ${this.canManage() ? `<td>
                  <button class="btn btn-sm btn-outline" onclick="window.powerPulseApp.editMeter('${m._id}')">Edit</button>
                  <button class="btn btn-sm btn-outline text-danger" onclick="window.powerPulseApp.deleteMeter('${m._id}')">Delete</button>
                </td>` : ''}
            `;
            tbody.appendChild(tr);
          });
        }

        lucide.createIcons();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    },

    async editLocation(id) {
      try {
        const res = await API.request(`/locations/${id}`);
        if (res.location) {
          document.getElementById('loc-edit-id').value = res.location._id;
          document.getElementById('loc-city').value = res.location.city || '';
          document.getElementById('loc-region').value = res.location.region || '';
          document.getElementById('loc-name').value = res.location.name || '';
          document.getElementById('loc-address').value = res.location.address || '';
          document.getElementById('loc-status').value = res.location.status || 'Active';
          document.getElementById('modal-location-title').textContent = 'Edit Location';
          document.getElementById('modal-location').classList.remove('hidden');
        }
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    },

    async deleteLocation(id) {
      if (!confirm('Deleting this location will also remove its meters and readings. Proceed?')) return;
      try {
        await API.deleteLocation(id);
        this.showToast('Location deleted', 'success');
        this.loadLocationsView();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    },

    async editMeter(id) {
      try {
        await this.populateLocationAndMeterDropdowns();
        const res = await API.request(`/meters/${id}`);
        if (res.meter) {
          document.getElementById('meter-edit-id').value = res.meter._id;
          document.getElementById('mtr-id').value = res.meter.meterId;
          document.getElementById('mtr-location').value = res.meter.location;
          document.getElementById('mtr-type').value = res.meter.type;
          document.getElementById('mtr-initial').value = res.meter.currentReading;
          document.getElementById('mtr-status').value = res.meter.status;
                    document.getElementById('mtr-owner').value = res.meter.ownerId ? res.meter.ownerId._id : '';
          document.getElementById('modal-meter-title').textContent = 'Edit Electricity Meter';
          document.getElementById('modal-meter').classList.remove('hidden');
        }
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    },

    async deleteMeter(id) {
      if (!confirm('Are you sure you want to delete this meter?')) return;
      try {
        await API.deleteMeter(id);
        this.showToast('Meter deleted', 'success');
        this.loadLocationsView();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    },

    // ==========================================
    // 9. ALERTS CONTROLLER
    // ==========================================
    setupAlertsEventListeners() {
      const applyAlertFilters = () => this.loadAlertsView();
      document.getElementById('alert-filter-status').addEventListener('change', applyAlertFilters);
      document.getElementById('alert-filter-severity').addEventListener('change', applyAlertFilters);
    },

    async loadAlertsView() {
      const status = document.getElementById('alert-filter-status').value;
      const severity = document.getElementById('alert-filter-severity').value;

      try {
        const res = await API.getAlerts({ status, severity });
        const tbody = document.getElementById('alerts-tbody');
        tbody.innerHTML = '';

        if (res.alerts) {
          res.alerts.forEach(a => {
            const sevBadge = a.severity === 'Critical' ? 'badge-danger' : a.severity === 'High' ? 'badge-warning' : 'badge-success';
            const statBadge = a.status === 'New' ? 'badge-danger' : a.status === 'Acknowledged' ? 'badge-warning' : 'badge-success';

            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td><span class="badge ${sevBadge}">${a.severity}</span></td>
              <td><strong>${a.type}</strong></td>
              <td>${a.location}</td>
              <td><code>${a.meterId}</code></td>
              <td>${a.message}</td>
              <td><span class="badge ${statBadge}">${a.status}</span></td>
              <td>${new Date(a.createdAt).toLocaleString()}</td>
              <td>
                ${a.status !== 'Resolved' ? `<button class="btn btn-sm btn-outline" onclick="window.powerPulseApp.updateAlertStatus('${a._id}', 'Resolved')">Resolve</button>` : ''}
                ${this.currentUser.role === 'Admin' ? `<button class="btn btn-sm btn-outline text-danger" onclick="window.powerPulseApp.deleteAlert('${a._id}')">Delete</button>` : ''}
              </td>
            `;
            tbody.appendChild(tr);
          });
        }
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    },

    async updateAlertStatus(id, status) {
      try {
        await API.updateAlertStatus(id, status);
        this.showToast(`Alert status updated to ${status}`, 'success');
        this.loadAlertsView();
        this.updateUnresolvedAlertBadges();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    },

    async deleteAlert(id) {
      try {
        await API.deleteAlert(id);
        this.showToast('Alert deleted', 'success');
        this.loadAlertsView();
        this.updateUnresolvedAlertBadges();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    },

    // ==========================================
    // 10. REPORTS CONTROLLER
    // ==========================================
    setupReportsEventListeners() {
      document.getElementById('btn-generate-report').addEventListener('click', () => {
        this.loadReportsView();
      });

      document.getElementById('btn-print-report').addEventListener('click', () => {
        window.print();
      });

      document.getElementById('btn-report-export-csv').addEventListener('click', () => {
        API.downloadCSV().catch(err => this.showToast(err.message, 'error'));
      });
    },

    async loadReportsView() {
      const range = document.getElementById('report-range').value;
      const location = document.getElementById('report-location').value;

      try {
        const res = await API.getReport({ range, location });
        if (res.success) {
          const meta = res.reportMetaData;
          const s = res.summary;

          document.getElementById('rpt-meta-date').textContent = meta.generatedAt;
          document.getElementById('rpt-meta-scope').textContent = meta.filterLocation;

          document.getElementById('rpt-sum-total').textContent = `${s.totalConsumption.toLocaleString()} kWh`;
          document.getElementById('rpt-sum-avg').textContent = `${s.avgConsumption.toLocaleString()} kWh/day`;
          document.getElementById('rpt-sum-peak').textContent = `${s.peakConsumption.toLocaleString()} kWh`;
          document.getElementById('rpt-sum-cost').textContent = `₹${s.totalCost.toLocaleString()}`;

          const locTbody = document.getElementById('rpt-location-tbody');
          locTbody.innerHTML = '';
          if (res.locationSummary) {
            res.locationSummary.forEach(l => {
              const tr = document.createElement('tr');
              tr.innerHTML = `
                <td><strong>${l.location}</strong></td>
                <td>${l.consumption.toLocaleString()} kWh</td>
                <td>₹${l.cost.toLocaleString()}</td>
                <td>${l.percentage}%</td>
              `;
              locTbody.appendChild(tr);
            });
          }

          const alertBox = document.getElementById('rpt-alerts-container');
          alertBox.innerHTML = '';
          if (res.alerts && res.alerts.length > 0) {
            res.alerts.forEach(a => {
              const p = document.createElement('p');
              p.style.fontSize = '0.85rem';
              p.innerHTML = `<strong class="text-danger">[${a.severity}] ${a.type}:</strong> ${a.message} (${a.location})`;
              alertBox.appendChild(p);
            });
          } else {
            alertBox.innerHTML = '<p style="font-size:0.85rem;" class="text-muted">No unresolved critical alerts during this reporting timeframe.</p>';
          }
        }
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    },

    // ==========================================
    // 11. SETTINGS CONTROLLER
    // ==========================================
    setupSettingsEventListeners() {
      document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const rate = parseFloat(document.getElementById('setting-rate').value);
        const high = parseInt(document.getElementById('setting-high-threshold').value, 10);
        const critical = parseInt(document.getElementById('setting-critical-threshold').value, 10);
        const name = document.getElementById('setting-sys-name').value;
        const curr = document.getElementById('setting-currency').value;
        const tz = document.getElementById('setting-timezone').value;

        try {
          await API.updateSettings({
            electricityRate: rate,
            highConsumptionThreshold: high,
            criticalConsumptionThreshold: critical,
            systemName: name,
            currency: curr,
            timeZone: tz
          });
          this.showToast('Settings saved successfully', 'success');
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });

      document.getElementById('btn-reset-demo-data').addEventListener('click', async () => {
        if (!confirm('Reset all database records and re-seed clean realistic demo dataset?')) return;
        try {
          await API.resetDemoData();
          this.showToast('Database reset and dataset re-seeded!', 'success');
          this.loadSettingsView();
          this.updateUnresolvedAlertBadges();
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    },

    async loadSettingsView() {
      try {
        const res = await API.getSettings();
        if (res.settings) {
          const s = res.settings;
          document.getElementById('setting-rate').value = s.electricityRate || 8.5;
          document.getElementById('setting-high-threshold').value = s.highConsumptionThreshold || 150;
          document.getElementById('setting-critical-threshold').value = s.criticalConsumptionThreshold || 200;
          document.getElementById('setting-sys-name').value = s.systemName || 'PowerPulse';
          document.getElementById('setting-currency').value = s.currency || '₹';
          document.getElementById('setting-timezone').value = s.timeZone || 'Asia/Kolkata';
        }
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    },

    setupUsersEventListeners() {
      const form = document.getElementById('user-create-form');
      const tbody = document.getElementById('users-tbody');

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const userData = {
          name: document.getElementById('new-user-name').value.trim(),
          email: document.getElementById('new-user-email').value.trim(),
          password: document.getElementById('new-user-password').value,
          role: document.getElementById('new-user-role').value
        };

        try {
          await API.createUser(userData);
          form.reset();
          this.showToast('User created successfully', 'success');
          this.loadUsersView();
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });

      tbody.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const row = button.closest('tr');
        const userId = row.getAttribute('data-user-id');
        try {
          if (button.dataset.action === 'role') {
            await API.updateUser(userId, { role: row.querySelector('select').value });
            this.showToast('User role updated', 'success');
          } else if (button.dataset.action === 'delete') {
            if (!confirm('Delete this user account?')) return;
            await API.deleteUser(userId);
            this.showToast('User deleted', 'success');
          }
          this.loadUsersView();
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    },

    async loadUsersView() {
      try {
        const response = await API.getUsers();
        const tbody = document.getElementById('users-tbody');
        const currentUserId = this.currentUser._id || this.currentUser.id;
        tbody.innerHTML = '';

        (response.users || []).forEach(user => {
          const row = document.createElement('tr');
          row.setAttribute('data-user-id', user._id);

          const nameCell = document.createElement('td');
          nameCell.textContent = user.name;
          const emailCell = document.createElement('td');
          emailCell.textContent = user.email;
          const roleCell = document.createElement('td');
          const roleSelect = document.createElement('select');
          ['Admin', 'Manager', 'Viewer'].forEach(role => {
            const option = document.createElement('option');
            option.value = role;
            option.textContent = role;
            option.selected = user.role === role;
            roleSelect.appendChild(option);
          });
          roleCell.appendChild(roleSelect);

          const createdCell = document.createElement('td');
          createdCell.textContent = new Date(user.createdAt).toLocaleDateString();
          const actionsCell = document.createElement('td');
          const saveButton = document.createElement('button');
          saveButton.type = 'button';
          saveButton.className = 'btn btn-sm btn-outline';
          saveButton.dataset.action = 'role';
          saveButton.textContent = 'Save Role';
          const deleteButton = document.createElement('button');
          deleteButton.type = 'button';
          deleteButton.className = 'btn btn-sm btn-outline text-danger';
          deleteButton.dataset.action = 'delete';
          deleteButton.textContent = 'Delete';
          deleteButton.disabled = user._id === currentUserId;
          actionsCell.append(saveButton, deleteButton);

          row.append(nameCell, emailCell, roleCell, createdCell, actionsCell);
          tbody.appendChild(row);
        });
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    }
  };

  window.powerPulseApp = App;

  document.addEventListener('DOMContentLoaded', () => App.init());
})();
