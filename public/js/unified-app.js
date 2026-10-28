/**
 * PowerPulse – Unified Single-Page Application (SPA) Controller
 * Everything in ONE website: Auth, Role-based Views, Live Charts, and Complaint Resolution
 */

// Global State
const State = {
  currentUser: null,
  activeRole: null,
  adminLocation: 'all',
  managerLocation: 'all',
  managerTrendPeriod: 'month',
  adminTrendPeriod: 'month',
  notifications: [],
  charts: {
    viewerUsage: null,
    mgrTrend: null,
    mgrHourly: null,
    admTrend: null,
    admLocation: null
  }
};

// UI Helper: Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'danger' || type === 'error') iconName = 'alert-circle';
  if (type === 'warning') iconName = 'alert-triangle';

  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <i data-lucide="${iconName}" style="width: 18px; height: 18px; flex-shrink: 0;"></i>
      <span style="font-size: 0.85rem; font-weight: 500;">${message}</span>
    </div>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

// -------------------------------------------------------------
// APP INITIALIZATION & VIEW ROUTING
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  setupTheme();
  if (window.lucide) lucide.createIcons();
  setupGlobalEvents();
  await loadPublicLocations();
  await checkSession();
});

function setupTheme() {
  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle-btn');
  const savedTheme = localStorage.getItem('powerpulse_theme');
  root.setAttribute('data-theme', savedTheme === 'light' ? 'light' : 'dark');

  const updateToggle = () => {
    if (!toggle) return;
    const isLight = root.getAttribute('data-theme') === 'light';
    toggle.setAttribute('aria-label', `Switch to ${isLight ? 'dark' : 'light'} mode`);
    toggle.innerHTML = `<i data-lucide="${isLight ? 'moon' : 'sun'}" aria-hidden="true" style="width: 16px; height: 16px;"></i><span>${isLight ? 'Dark mode' : 'Light mode'}</span>`;
    if (window.lucide) lucide.createIcons();
  };

  updateToggle();
  toggle?.addEventListener('click', () => {
    const nextTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', nextTheme);
    localStorage.setItem('powerpulse_theme', nextTheme);
    updateToggle();
  });
}

// Setup Global Event Listeners
function setupGlobalEvents() {
  const roleNotes = {
    Viewer: 'Use the email and password provided for your Viewer account.',
    Manager: 'Sign in with the Manager account provided by your system administrator. Manager accounts cannot self-register.',
    Admin: 'Sign in with the Admin account provided by your system administrator. Admin accounts cannot self-register.'
  };
  document.querySelectorAll('.login-role-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.login-role-option').forEach(button => {
        const selected = button === option;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      document.getElementById('login-role-note').textContent = roleNotes[option.dataset.loginRole];
    });
  });

  const signInPane = document.getElementById('auth-pane-signin');
  const registerPane = document.getElementById('auth-pane-register');
  const showRegisterButton = document.getElementById('btn-show-viewer-register');
  const showLoginButton = document.getElementById('btn-show-login');
  if (signInPane && registerPane && showRegisterButton && showLoginButton) {
    showRegisterButton.addEventListener('click', () => {
      signInPane.style.display = 'none';
      registerPane.style.display = 'block';
    });
    showLoginButton.addEventListener('click', () => {
      registerPane.style.display = 'none';
      signInPane.style.display = 'block';
    });
  }

  // Notifications dropdown toggle
  const notifBtn = document.getElementById('btn-header-notifications');
  const notifDropdown = document.getElementById('notifications-dropdown');
  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifDropdown.classList.toggle('active');
      if (notifDropdown.classList.contains('active')) loadNotifications();
    });

    document.addEventListener('click', (e) => {
      if (!notifDropdown.contains(e.target) && e.target !== notifBtn) {
        notifDropdown.classList.remove('active');
      }
    });
  }

  // Mark all notifications as read
  document.querySelectorAll('.btn-mark-all-read').forEach(btnMarkRead => {
    btnMarkRead.addEventListener('click', async () => {
      try {
        await API.markAllNotificationsRead();
        await loadNotifications();
        showToast('All notifications marked as read', 'success');
      } catch (e) {
        showToast(e.message || 'Unable to mark notifications as read', 'danger');
      }
    });
  });

  // Header Sign Out button
  const btnSignOut = document.getElementById('btn-header-signout');
  if (btnSignOut) {
    btnSignOut.addEventListener('click', () => {
      signOut();
    });
  }

  // Show/Hide password toggles
  document.querySelectorAll('.btn-toggle-pwd').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;
      const isPwd = input.type === 'password';
      input.type = isPwd ? 'text' : 'password';
      btn.innerHTML = isPwd 
        ? '<i data-lucide="eye-off" style="width: 16px; height: 16px;"></i>' 
        : '<i data-lucide="eye" style="width: 16px; height: 16px;"></i>';
      if (window.lucide) lucide.createIcons();
    });
  });

  // Login Form Submission
  const loginForm = document.getElementById('form-unified-login');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-login-email').value.trim();
      const password = document.getElementById('auth-login-pwd').value;
      const expectedRole = document.querySelector('.login-role-option.active')?.dataset.loginRole;
      const btn = document.getElementById('btn-submit-login');
      const alertBox = document.getElementById('login-alert-box');

      alertBox.style.display = 'none';
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-sm"></span> Signing In...';

      try {
        const res = await API.login(email, password, expectedRole);
        State.currentUser = res.user;
        showToast(`Welcome back, ${res.user.name}!`, 'success');
        activateRoleView(res.user.role);
      } catch (err) {
        alertBox.textContent = err.message || 'Login failed. Please check your credentials.';
        alertBox.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Sign In to PowerPulse</span> <i data-lucide="arrow-right" style="width: 16px; height: 16px;"></i>';
        if (window.lucide) lucide.createIcons();
      }
    });
  }

  const registerForm = document.getElementById('form-unified-register');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-pwd').value;
      const location = document.getElementById('reg-location').value;
      const button = document.getElementById('btn-submit-register');
      const alertBox = document.getElementById('register-alert-box');

      alertBox.style.display = 'none';
      button.disabled = true;
      button.textContent = 'Creating account...';

      try {
        const result = await API.registerViewer(name, email, password, location);
        State.currentUser = result.user;
        showToast(`Viewer account created. Welcome, ${result.user.name}!`, 'success');
        activateRoleView('Viewer');
      } catch (error) {
        alertBox.textContent = error.message || 'Unable to create your account';
        alertBox.style.display = 'block';
      } finally {
        button.disabled = false;
        button.textContent = 'Create Viewer Account';
      }
    });
  }

}

// Check current session
async function checkSession() {
  const token = API.getToken();
  if (!token) {
    switchMainView('view-guest');
    return;
  }

  try {
    const data = await API.getMe();
    if (data.user) {
      State.currentUser = data.user;
      activateRoleView(data.user.role);
    } else {
      signOut(false);
    }
  } catch (err) {
    console.error('Session verify error:', err);
    signOut(false);
  }
}

// Switch Active View
function switchMainView(viewId) {
  document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add('active');
  }

  // Update header elements
  const authHeader = document.getElementById('header-auth-actions');

  if (viewId === 'view-guest') {
    if (authHeader) authHeader.style.display = 'none';
  } else {
    if (authHeader) authHeader.style.display = 'flex';

    // Update user badge and location
    if (State.currentUser) {
      const u = State.currentUser;
      const nameElem = document.getElementById('hdr-user-name');
      const roleElem = document.getElementById('hdr-user-role');
      const locElem = document.getElementById('hdr-user-location');

      if (nameElem) nameElem.textContent = u.name;
      if (roleElem) {
        roleElem.textContent = u.role;
        roleElem.className = `auth-role-badge badge-${u.role.toLowerCase()}`;
      }
      if (locElem) {
        let loc = 'Regional Grid Substation';
        if (u.role === 'Admin') {
          loc = State.adminLocation === 'all' ? 'All Locations' : State.adminLocation;
        } else if (u.role === 'Manager') {
          loc = State.managerLocation === 'all' ? 'All Locations' : State.managerLocation;
        } else {
          loc = (u.assignedLocations && u.assignedLocations[0]) || u.location || 'Regional Grid Substation';
        }
        locElem.textContent = loc;
      }
    }
  }

  if (window.lucide) lucide.createIcons();
}

// Sign Out
function signOut(showNotification = true) {
  API.clearAuth();
  State.currentUser = null;
  State.activeRole = null;
  State.adminLocation = 'all';
  State.managerLocation = 'all';
  
  // Destroy chart instances
  Object.keys(State.charts).forEach(key => {
    if (State.charts[key]) {
      State.charts[key].destroy();
      State.charts[key] = null;
    }
  });

  switchMainView('view-guest');
  if (showNotification) {
    showToast('You have been signed out successfully', 'info');
  }
}

// Activate Role Specific View
function activateRoleView(role) {
  State.activeRole = role;
  loadNotifications();

  if (role === 'Viewer') {
    switchMainView('view-viewer');
    initViewerView();
  } else if (role === 'Manager') {
    switchMainView('view-manager');
    initManagerView();
  } else if (role === 'Admin') {
    switchMainView('view-admin');
    initAdminView();
  } else {
    switchMainView('view-guest');
  }
}

// Load In-App Notifications
async function loadNotifications() {
  if (!API.getToken()) return;
  try {
    const data = await API.getNotifications();
    const notifs = data.notifications || [];
    State.notifications = notifs;

    const countElem = document.getElementById('header-notif-count');
    const listElem = document.getElementById('header-notif-list');

    const unreadCount = data.unreadCount || notifs.filter(n => !n.read).length;
    if (countElem) {
      countElem.textContent = unreadCount;
      countElem.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }

    if (listElem) {
      listElem.replaceChildren();
      if (notifs.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.style.cssText = 'padding: 24px; text-align: center; color: #94a3b8; font-size: 0.8rem;';
        emptyState.textContent = 'No notifications yet';
        listElem.appendChild(emptyState);
      } else {
        notifs.slice(0, 10).forEach(notification => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = `notif-item notification-action ${notification.read ? '' : 'unread'}`;
          item.style.cssText = `display: block; width: 100%; border: 0; text-align: left; background: ${notification.read ? 'transparent' : 'rgba(59, 130, 246, 0.08)'};`;

          const title = document.createElement('div');
          title.style.cssText = `font-size: 0.82rem; color: #f8fafc; font-weight: ${notification.read ? '400' : '600'}; margin-bottom: 4px;`;
          title.textContent = notification.title;

          const message = document.createElement('div');
          message.style.cssText = 'font-size: 0.75rem; color: #cbd5e1; line-height: 1.4;';
          message.textContent = notification.message;

          const time = document.createElement('div');
          time.style.cssText = 'font-size: 0.7rem; color: #94a3b8; margin-top: 4px;';
          time.textContent = new Date(notification.createdAt).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short'
          });

          item.append(title, message, time);
          item.addEventListener('click', async () => {
            try {
              if (!notification.read) {
                await API.markNotificationRead(notification._id);
                await loadNotifications();
              }
              document.getElementById('notifications-dropdown').classList.remove('active');
              await openRelatedNotification(notification);
            } catch (error) {
              showToast(error.message || 'Unable to open this notification', 'danger');
            }
          });
          listElem.appendChild(item);
        });
      }
    }

    document.querySelectorAll('.role-notification-list').forEach(roleList => {
      roleList.replaceChildren();
      if (notifs.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'card';
        emptyState.style.cssText = 'padding: 20px; text-align: center; color: #94a3b8;';
        emptyState.textContent = 'No notifications yet.';
        roleList.appendChild(emptyState);
        return;
      }
      notifs.forEach(notification => roleList.appendChild(createNotificationItem(notification)));
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
  }
}

function createNotificationItem(notification) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = `notif-item notification-action ${notification.read ? '' : 'unread'}`;
  item.style.cssText = `background: ${notification.read ? 'rgba(15, 23, 42, 0.55)' : 'rgba(59, 130, 246, 0.12)'};`;

  const title = document.createElement('div');
  title.style.cssText = `font-size: 0.82rem; color: #f8fafc; font-weight: ${notification.read ? '500' : '700'}; margin-bottom: 4px;`;
  title.textContent = notification.title;

  const message = document.createElement('div');
  message.style.cssText = 'font-size: 0.78rem; color: #cbd5e1; line-height: 1.45;';
  message.textContent = notification.message;

  const time = document.createElement('div');
  time.style.cssText = 'font-size: 0.7rem; color: #94a3b8; margin-top: 6px;';
  time.textContent = new Date(notification.createdAt).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  item.append(title, message, time);
  item.addEventListener('click', async () => {
    try {
      if (!notification.read) {
        await API.markNotificationRead(notification._id);
        await loadNotifications();
      }
      document.getElementById('notifications-dropdown')?.classList.remove('active');
      await openRelatedNotification(notification);
    } catch (error) {
      showToast(error.message || 'Unable to open this notification', 'danger');
    }
  });
  return item;
}

async function openRelatedNotification(notification) {
  if (!notification.relatedId) return;

  if (State.activeRole === 'Viewer') {
    document.querySelector('[data-tab="v-pane-complaints"]')?.click();
    await window.openComplaintDetails(notification.relatedId);
  } else if (State.activeRole === 'Manager') {
    document.querySelector('[data-tab="mgr-pane-complaints"]')?.click();
    await window.openManagerResolveModal(notification.relatedId);
  } else if (State.activeRole === 'Admin') {
    document.querySelector('[data-tab="adm-pane-complaints"]')?.click();
    await window.openAdminComplaintControl(notification.relatedId);
  }
}


// =============================================================
// 1. VIEWER DASHBOARD CONTROLLER
// =============================================================
function initViewerView() {
  document.querySelectorAll('.viewer-tab-trigger').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.viewer-subpane').forEach(p => p.classList.remove('active'));
  const firstTab = document.querySelector('.viewer-tab-trigger[data-tab="v-pane-overview"]');
  const firstPane = document.getElementById('v-pane-overview');
  if (firstTab) firstTab.classList.add('active');
  if (firstPane) firstPane.classList.add('active');

  setupViewerTabs();
  loadViewerOverview();
  loadViewerComplaints();
  setupViewerComplaintModal();
}

function setupViewerTabs() {
  document.querySelectorAll('.viewer-tab-trigger').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.viewer-tab-trigger').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.viewer-subpane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
      if (window.lucide) lucide.createIcons();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  });
}

async function loadViewerOverview() {
  try {
    const data = await API.getViewerOverview();
    
    // Status banner
    const statusCard = document.getElementById('v-status-card');
    const statusDot = document.getElementById('v-status-dot');
    const statusText = document.getElementById('v-status-text');
    const statusDesc = document.getElementById('v-status-desc');

    if (data.electricityStatus === 'High Consumption') {
      if (statusCard) statusCard.className = 'status-card status-high';
      if (statusDot) statusDot.className = 'pulse-dot dot-danger';
      if (statusText) statusText.textContent = 'High Consumption Warning';
      if (statusDesc) statusDesc.textContent = `Current usage exceeds standard threshold (${data.threshold} kWh). Please inspect active loads.`;
    } else {
      if (statusCard) statusCard.className = 'status-card status-normal';
      if (statusDot) statusDot.className = 'pulse-dot dot-success';
      if (statusText) statusText.textContent = 'Normal Consumption';
      if (statusDesc) statusDesc.textContent = `Facility load is stable within standard operational threshold (${data.threshold} kWh limit).`;
    }

    // KPIs
    const elLatest = document.getElementById('v-kpi-latest-kwh');
    const elLatestTime = document.getElementById('v-kpi-latest-time');
    const elToday = document.getElementById('v-kpi-today-kwh');
    const elMonthly = document.getElementById('v-kpi-monthly-kwh');
    const elMonthlyCost = document.getElementById('v-kpi-monthly-cost');
    const elMeterBadge = document.getElementById('v-assigned-meter-badge');
    const elLocTag = document.getElementById('v-location-tag');

    const assignedLocation = data.assignedLocation || (State.currentUser?.assignedLocations?.[0]) || State.currentUser?.location || 'Mumbai - BKC Distribution Hub';
    const assignedMeter = data.meters && data.meters[0] ? data.meters[0].meterId : 'MTR-MUM-01';

    if (elLatest) elLatest.textContent = `${data.latestReading.consumption} kWh`;
    if (elLatestTime) elLatestTime.textContent = `Recorded: ${data.latestReading.date} ${data.latestReading.time}`;
    if (elToday) elToday.textContent = `${data.todayKWh} kWh`;
    if (elMonthly) elMonthly.textContent = `${data.monthlyKWh} kWh`;
    if (elMonthlyCost) elMonthlyCost.textContent = `Est. Cost: ₹${data.monthlyCost.toLocaleString()}`;
    if (elMeterBadge) elMeterBadge.textContent = assignedMeter;
    if (elLocTag) elLocTag.textContent = assignedLocation;

    const hdrLoc = document.getElementById('hdr-user-location');
    if (hdrLoc) hdrLoc.textContent = assignedLocation;

    const vProfLoc = document.getElementById('v-profile-location');
    if (vProfLoc) vProfLoc.value = assignedLocation;

    const vProfMeter = document.getElementById('v-profile-meter');
    if (vProfMeter) vProfMeter.value = assignedMeter;

    // Render 7-day usage chart
    renderViewerChart(data.chart.labels, data.chart.data);
  } catch (err) {
    console.error('Error loading viewer overview:', err);
  }
}

function renderViewerChart(labels, values) {
  const canvas = document.getElementById('chart-viewer-usage');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (State.charts.viewerUsage) {
    State.charts.viewerUsage.destroy();
  }

  State.charts.viewerUsage = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.map(l => l.slice(5)),
      datasets: [{
        label: 'Daily Consumption (kWh)',
        data: values,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        borderWidth: 3,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#3b82f6',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e293b',
          callbacks: { label: ctx => `Usage: ${ctx.parsed.y} kWh` }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8', callback: v => `${v} kWh` } }
      }
    }
  });
}

async function loadViewerComplaints() {
  const tableBody = document.getElementById('viewer-complaints-tbody');
  if (!tableBody) return;

  try {
    const data = await API.getComplaints();
    const complaints = data.complaints || [];

    if (complaints.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 30px; color: #94a3b8;">
            <i data-lucide="check-circle" style="width: 24px; height: 24px; color: #10b981; margin-bottom: 6px;"></i>
            <div>No complaints submitted. All systems operating smoothly.</div>
          </td>
        </tr>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    tableBody.innerHTML = complaints.map(c => `
      <tr>
        <td><strong style="color: #38bdf8; font-family: monospace;">${c.complaintId}</strong></td>
        <td>
          <div style="font-weight: 600; color: #fff;">${c.title}</div>
          <small style="color: #94a3b8;">${c.category}</small>
        </td>
        <td><span style="font-size: 0.8rem; color: #cbd5e1;">India</span></td>
        <td>
          <span class="complaint-status-pill status-${c.status.toLowerCase().replace(/\s+/g, '-')}">
            ${c.status}
          </span>
        </td>
        <td><span style="font-size: 0.78rem; color: #94a3b8;">${new Date(c.createdAt).toLocaleDateString()}</span></td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="openComplaintDetails('${c._id}')">
            <span>View & Reply</span>
          </button>
        </td>
      </tr>
    `).join('');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Error loading complaints:', err);
  }
}

function setupViewerComplaintModal() {
  const btnReport = document.getElementById('btn-open-report-problem');
  const modalReport = document.getElementById('modal-report-problem');
  const btnCloseReport = document.getElementById('btn-close-report-modal');
  const btnCancelReport = document.getElementById('btn-cancel-report-modal');
  const formReport = document.getElementById('form-submit-complaint');

  if (btnReport && modalReport) {
    btnReport.onclick = () => modalReport.classList.remove('hidden');
  }

  if (btnCloseReport && modalReport) {
    btnCloseReport.onclick = () => modalReport.classList.add('hidden');
  }
  if (btnCancelReport && modalReport) {
    btnCancelReport.onclick = () => modalReport.classList.add('hidden');
  }

  if (formReport) {
    formReport.onsubmit = async (e) => {
      e.preventDefault();
      const title = document.getElementById('cmp-title').value.trim();
      const category = document.getElementById('cmp-category').value;
      const description = document.getElementById('cmp-description').value.trim();
      const meterRef = document.getElementById('cmp-meter-ref').value.trim();

      const btnSubmit = document.getElementById('btn-submit-problem');
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Submitting...';

      try {
        const res = await API.createComplaint({
          title,
          category,
          description,
          meterId: meterRef || undefined
        });

        showToast(`Complaint ${res.complaint.complaintId} submitted successfully! Status: Pending`, 'success');
        modalReport.classList.add('hidden');
        formReport.reset();
        await loadViewerComplaints();
        await loadViewerOverview();
      } catch (err) {
        showToast(err.message || 'Failed to submit complaint', 'danger');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Submit Complaint';
      }
    };
  }
}

// Global modal opener for Complaint Details
window.openComplaintDetails = async function(complaintId) {
  const modal = document.getElementById('modal-complaint-details');
  if (!modal) return;

  try {
    const data = await API.getComplaint(complaintId);
    const c = data.complaint;

    document.getElementById('dtl-cmp-id').textContent = c.complaintId;
    document.getElementById('dtl-cmp-title').textContent = c.title;
    document.getElementById('dtl-cmp-cat').textContent = c.category;
    document.getElementById('dtl-cmp-loc').textContent = 'India';
    document.getElementById('dtl-cmp-desc').textContent = c.description;
    document.getElementById('dtl-cmp-status').textContent = c.status;
    document.getElementById('dtl-cmp-status').className = `complaint-status-pill status-${c.status.toLowerCase().replace(/\s+/g, '-')}`;

    // Resolution box
    const resBox = document.getElementById('dtl-resolution-box');
    const resDetails = document.getElementById('dtl-resolution-details');
    if (c.resolutionDetails) {
      resBox.style.display = 'block';
      resDetails.textContent = c.resolutionDetails;
    } else {
      resBox.style.display = 'none';
    }

    // Messages thread
    const msgContainer = document.getElementById('dtl-messages-container');
    const messages = c.messages || [];
    if (messages.length === 0) {
      msgContainer.innerHTML = '<div style="font-size: 0.78rem; color: #94a3b8; font-style: italic;">No communication messages recorded yet.</div>';
    } else {
      msgContainer.innerHTML = messages.map(m => `
        <div style="background: rgba(15, 23, 42, 0.6); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; border-left: 3px solid ${m.senderRole === 'Viewer' ? '#3b82f6' : '#06b6d4'};">
          <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #94a3b8; margin-bottom: 4px;">
            <strong>${m.senderName} (${m.senderRole})</strong>
            <span>${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div style="font-size: 0.82rem; color: #f8fafc;">${m.message}</div>
        </div>
      `).join('');
    }

    // Setup follow-up message form
    const msgForm = document.getElementById('form-dtl-message');
    msgForm.onsubmit = async (e) => {
      e.preventDefault();
      const input = document.getElementById('dtl-input-message');
      const text = input.value.trim();
      if (!text) return;

      try {
        await API.addComplaintMessage(c._id, text);
        input.value = '';
        showToast('Message sent', 'success');
        openComplaintDetails(c._id); // reload modal
      } catch (err) {
        showToast(err.message, 'danger');
      }
    };

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    showToast('Failed to load complaint details', 'danger');
  }
};

// Close Complaint Details Modal
document.addEventListener('DOMContentLoaded', () => {
  const btnClose = document.getElementById('btn-close-dtl-modal');
  const modal = document.getElementById('modal-complaint-details');
  if (btnClose && modal) {
    btnClose.onclick = () => modal.classList.add('hidden');
  }
});

// =============================================================
// 2. MANAGER DASHBOARD CONTROLLER
// =============================================================
function formatTrendLabel(label, period) {
  if (period === 'day') return label;
  if (period === 'year') {
    const [year, month] = label.split('-');
    const monthName = new Date(Date.UTC(Number(year), Number(month) - 1, 1))
      .toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    return `${monthName} ${year}`;
  }
  return label.slice(5);
}

function updateTrendDescription(role, period, location = 'all') {
  const labels = {
    day: 'Hourly electricity consumption for the last 24 hours.',
    week: 'Daily electricity consumption for the last 7 days.',
    month: 'Daily electricity consumption for the last 30 days.',
    year: 'Monthly electricity consumption for the last 12 months.'
  };
  const titleId = role === 'mgr' ? 'mgr-trend-title' : 'adm-trend-title';
  const descriptionId = role === 'mgr' ? 'mgr-trend-description' : 'adm-trend-description';
  const title = document.getElementById(titleId);
  const description = document.getElementById(descriptionId);
  const periodName = period.charAt(0).toUpperCase() + period.slice(1);
  if (title) {
    if (role === 'mgr') {
      title.textContent = `${location === 'all' ? 'All Locations' : location} Consumption Trend (${periodName})`;
    } else {
      title.textContent = `${location === 'all' ? 'National Electricity' : location} Consumption Trend (${periodName})`;
    }
  }
  if (description) {
    const periodDescription = labels[period] || labels.month;
    if (location !== 'all') {
      description.textContent = `${periodDescription} Showing ${location}.`;
    } else {
      description.textContent = role === 'mgr'
        ? 'Daily electricity consumption across all locations.'
        : 'Daily aggregate load across all grids.';
    }
  }
}

function initManagerView() {
  document.querySelectorAll('.mgr-tab-trigger').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.mgr-subpane').forEach(p => p.classList.remove('active'));
  const firstTab = document.querySelector('.mgr-tab-trigger[data-tab="mgr-pane-overview"]');
  const firstPane = document.getElementById('mgr-pane-overview');
  if (firstTab) firstTab.classList.add('active');
  if (firstPane) firstPane.classList.add('active');

  setupManagerTabs();
  const managerLocation = document.getElementById('mgr-location-select');
  if (managerLocation) {
    managerLocation.value = State.managerLocation;
    managerLocation.onchange = () => {
      State.managerLocation = managerLocation.value;
      const headerLocation = document.getElementById('hdr-user-location');
      if (headerLocation) {
        headerLocation.textContent = State.managerLocation === 'all' ? 'All Locations' : State.managerLocation;
      }
      loadManagerOverview();
    };
    loadManagerLocations(managerLocation);
  }
  const managerPeriod = document.getElementById('mgr-trend-period');
  if (managerPeriod) {
    managerPeriod.value = State.managerTrendPeriod;
    managerPeriod.onchange = () => {
      State.managerTrendPeriod = managerPeriod.value;
      loadManagerOverview();
    };
  }
  loadManagerComplaints();
  loadManagerMeters();
  loadManagerAlerts();
}

function setupManagerTabs() {
  document.querySelectorAll('.mgr-tab-trigger').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.mgr-tab-trigger').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.mgr-subpane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
      if (window.lucide) lucide.createIcons();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  });
}

async function loadManagerOverview() {
  try {
    const assignedLoc = State.managerLocation;
    const period = State.managerTrendPeriod;
    const summaryResponse = await API.getSummary({ period, location: assignedLoc });
    const summary = summaryResponse.summary;
    const complaintsResponse = await API.getComplaints();
    const openComplaints = (complaintsResponse.complaints || []).filter(complaint =>
      ['Pending', 'In Progress'].includes(complaint.status)
    ).length;

    document.getElementById('mgr-kpi-consumption').textContent = `${summary.totalConsumption || 0} kWh`;
    document.getElementById('mgr-kpi-meters').textContent = summary.activeMetersCount || 0;
    document.getElementById('mgr-kpi-complaints').textContent = openComplaints;

    // Load Charts
    const trend = await API.getTrend({ period, location: assignedLoc });
    renderManagerTrendChart(trend.labels, trend.data, period);
    updateTrendDescription('mgr', period, assignedLoc);
  } catch (err) {
    console.error('Error loading manager overview:', err);
  }
}

async function loadManagerLocations(select) {
  try {
    const data = await API.getLocations();
    const selectedLocation = State.managerLocation;
    select.replaceChildren();

    const allLocationsOption = document.createElement('option');
    allLocationsOption.value = 'all';
    allLocationsOption.textContent = 'All Locations';
    select.appendChild(allLocationsOption);
    (data.locations || []).forEach(location => {
      const option = document.createElement('option');
      option.value = location.name;
      option.textContent = location.name;
      select.appendChild(option);
    });
    select.value = (data.locations || []).some(location => location.name === selectedLocation)
      ? selectedLocation
      : 'all';
    State.managerLocation = select.value;

    const headerLocation = document.getElementById('hdr-user-location');
    if (headerLocation) {
      headerLocation.textContent = State.managerLocation === 'all' ? 'All Locations' : State.managerLocation;
    }
    loadManagerOverview();
  } catch (error) {
    console.error('Error loading manager locations:', error);
    showToast(error.message || 'Unable to load locations', 'danger');
  }
}

function renderManagerTrendChart(labels, values, period) {
  const canvas = document.getElementById('chart-mgr-trend');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (State.charts.mgrTrend) {
    State.charts.mgrTrend.destroy();
  }

  State.charts.mgrTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.map(label => formatTrendLabel(label, period)),
      datasets: [{
        label: 'Regional Load (kWh)',
        data: values,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#06b6d4'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8', callback: v => `${v} kWh` } }
      }
    }
  });
}

async function loadManagerComplaints() {
  const tbody = document.getElementById('mgr-complaints-tbody');
  if (!tbody) return;

  try {
    const data = await API.getComplaints();
    const complaints = data.complaints || [];

    if (complaints.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px; color: #94a3b8;">No assigned complaints for your regional jurisdiction.</td></tr>';
      return;
    }

    tbody.innerHTML = complaints.map(c => `
      <tr>
        <td><strong style="color: #22d3ee; font-family: monospace;">${c.complaintId}</strong></td>
        <td>
          <div style="font-weight: 600; color: #fff;">${c.title}</div>
          <small style="color: #94a3b8;">Viewer: ${c.viewerName}</small>
        </td>
        <td><span style="font-size: 0.8rem; color: #cbd5e1;">${c.location}</span></td>
        <td>
          <span class="complaint-status-pill status-${c.status.toLowerCase().replace(/\s+/g, '-')}">
            ${c.status}
          </span>
        </td>
        <td><span class="priority-pill priority-${c.priority.toLowerCase()}">${c.priority}</span></td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="openManagerResolveModal('${c._id}')">
            <span>Investigate & Solve</span>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading manager complaints:', err);
  }
}

// Manager Resolve Modal
window.openManagerResolveModal = async function(complaintId) {
  const modal = document.getElementById('modal-mgr-resolve');
  if (!modal) return;

  try {
    const data = await API.getComplaint(complaintId);
    const c = data.complaint;

    document.getElementById('mgr-res-id').textContent = c.complaintId;
    document.getElementById('mgr-res-title').textContent = c.title;
    document.getElementById('mgr-res-desc').textContent = c.description;
    document.getElementById('mgr-res-viewer').textContent = `${c.viewerName} (${c.viewerEmail})`;
    document.getElementById('mgr-res-location').textContent = c.location;
    document.getElementById('mgr-res-status-select').value = c.status;
    document.getElementById('mgr-res-notes').value = c.resolutionDetails || '';

    const form = document.getElementById('form-mgr-resolve');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const status = document.getElementById('mgr-res-status-select').value;
      const resolutionDetails = document.getElementById('mgr-res-notes').value.trim();
      const responseMessage = document.getElementById('mgr-res-reply').value.trim();

      try {
        await API.updateComplaintStatus(c._id, status, responseMessage, resolutionDetails);
        showToast(`Complaint ${c.complaintId} updated to ${status}`, 'success');
        modal.classList.add('hidden');
        await loadManagerComplaints();
        await loadManagerOverview();
      } catch (err) {
        showToast(err.message || 'Failed to update complaint', 'danger');
      }
    };

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    showToast('Failed to load complaint data', 'danger');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const btnClose = document.getElementById('btn-close-mgr-modal');
  const modal = document.getElementById('modal-mgr-resolve');
  if (btnClose && modal) {
    btnClose.onclick = () => modal.classList.add('hidden');
  }
});

async function loadManagerMeters() {
  const tbody = document.getElementById('mgr-meters-tbody');
  if (!tbody) return;

  try {
    const data = await API.getMeters();
    const meters = data.meters || [];

    tbody.innerHTML = meters.map(m => `
      <tr>
        <td><strong style="color: #38bdf8; font-family: monospace;">${m.meterId}</strong></td>
        <td>${m.location}</td>
        <td><span style="font-size: 0.8rem; color: #cbd5e1;">${m.type}</span></td>
        <td><strong>${m.currentReading} kWh</strong></td>
        <td><span class="badge badge-active">${m.status}</span></td>
      </tr>
    `).join('');

    // Telemetry injection form
    const selectMeter = document.getElementById('sim-meter-select');
    if (selectMeter) {
      selectMeter.innerHTML = meters.map(m => `<option value="${m.meterId}">${m.meterId} (${m.location})</option>`).join('');
    }

    const simForm = document.getElementById('form-sim-telemetry');
    if (simForm) {
      const dateInput = document.getElementById('sim-reading-date');
      const timeInput = document.getElementById('sim-reading-time');
      const now = new Date();
      if (dateInput && !dateInput.value) {
        dateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      }
      if (timeInput && !timeInput.value) {
        timeInput.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      }

      simForm.onsubmit = async (e) => {
        e.preventDefault();
        const meterId = selectMeter.value;
        const consumption = parseFloat(document.getElementById('sim-kwh-value').value);
        const selectedMeter = meters.find(m => m.meterId === meterId);

        try {
          if (!selectedMeter) {
            throw new Error('Select a valid meter before submitting the reading');
          }
          await API.createReading({
            meterId,
            consumption,
            location: selectedMeter.location,
            date: dateInput.value,
            time: timeInput.value,
            readingType: selectedMeter.type === 'Manual Meter' ? 'Manual' : 'Smart Meter'
          });
          showToast(`Reading submitted successfully for ${meterId}`, 'success');
          simForm.reset();
          dateInput.value = '';
          timeInput.value = '';
          await loadManagerOverview();
          await loadManagerMeters();
          await loadManagerAlerts();
        } catch (err) {
          showToast(err.message, 'danger');
        }
      };
    }
  } catch (err) {
    console.error('Error loading meters:', err);
  }
}

async function loadManagerAlerts() {
  const container = document.getElementById('mgr-alerts-container');
  if (!container) return;

  try {
    const data = await API.getAlerts();
    const alerts = data.alerts || [];

    if (alerts.length === 0) {
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: #94a3b8;">No high consumption alerts detected. Operations are nominal.</div>';
      return;
    }

    container.innerHTML = alerts.map(a => `
      <div style="background: rgba(30, 41, 59, 0.7); border-left: 4px solid #ef4444; border-radius: 8px; padding: 14px 18px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 700; color: #f87171; font-size: 0.9rem;">${a.title}</div>
          <div style="font-size: 0.8rem; color: #cbd5e1; margin-top: 2px;">${a.message}</div>
          <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 4px;">Location: ${a.location} • Meter: ${a.meterId || 'Grid'}</div>
        </div>
        <span style="font-size: 0.75rem; color: #94a3b8;">${new Date(a.createdAt).toLocaleTimeString()}</span>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading alerts:', err);
  }
}


// =============================================================
// 3. ADMIN DASHBOARD CONTROLLER
// =============================================================
function initAdminView() {
  document.querySelectorAll('.adm-tab-trigger').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.adm-subpane').forEach(p => p.classList.remove('active'));
  const firstTab = document.querySelector('.adm-tab-trigger[data-tab="adm-pane-overview"]');
  const firstPane = document.getElementById('adm-pane-overview');
  if (firstTab) firstTab.classList.add('active');
  if (firstPane) firstPane.classList.add('active');

  setupAdminTabs();

  const adminLocation = document.getElementById('adm-location-select');
  if (adminLocation) {
    adminLocation.value = State.adminLocation;
    adminLocation.onchange = () => {
      State.adminLocation = adminLocation.value;
      const headerLocation = document.getElementById('hdr-user-location');
      if (headerLocation) {
        headerLocation.textContent = State.adminLocation === 'all' ? 'All Locations' : State.adminLocation;
      }
      loadAdminOverview();
    };
  }

  const adminPeriod = document.getElementById('adm-trend-period');
  if (adminPeriod) {
    adminPeriod.value = State.adminTrendPeriod;
    adminPeriod.onchange = () => {
      State.adminTrendPeriod = adminPeriod.value;
      loadAdminOverview();
    };
  }
  loadAdminOverview();
  loadAdminComplaints();
  loadAdminUsers();
  loadAdminSettings();
  loadAdminLocations();
}

function setupAdminTabs() {
  document.querySelectorAll('.adm-tab-trigger').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.adm-tab-trigger').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.adm-subpane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
      if (window.lucide) lucide.createIcons();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  });
}

async function loadAdminOverview() {
  try {
    const period = State.adminTrendPeriod;
    const location = State.adminLocation;
    const summaryResponse = await API.getSummary({ period, location });
    const summary = summaryResponse.summary;
    const complaintsResponse = await API.getComplaints();
    let openComplaints = (complaintsResponse.complaints || []).filter(complaint =>
      ['Pending', 'In Progress'].includes(complaint.status)
    );
    if (location && location !== 'all') {
      openComplaints = openComplaints.filter(c => c.location === location);
    }
    const openComplaintsCount = openComplaints.length;

    const isAll = !location || location === 'all';
    const cTitle = document.getElementById('adm-kpi-consumption-title');
    const cSub = document.getElementById('adm-kpi-consumption-sub');
    const mTitle = document.getElementById('adm-kpi-meters-title');
    const mSub = document.getElementById('adm-kpi-meters-sub');
    const compTitle = document.getElementById('adm-kpi-complaints-title');
    const compSub = document.getElementById('adm-kpi-complaints-sub');

    if (cTitle) cTitle.textContent = isAll ? 'Total National Consumption' : 'Location Consumption';
    if (cSub) cSub.textContent = isAll ? 'Grid Draw (Past 30 Days)' : `${location} Grid Draw`;
    if (mTitle) mTitle.textContent = isAll ? 'Active Grid Meters' : 'Active Location Meters';
    if (mSub) mSub.textContent = isAll ? 'Online Across 7 Metros' : `${location} Sensors`;
    if (compTitle) compTitle.textContent = isAll ? 'Total National Issues' : 'Location Facility Issues';
    if (compSub) compSub.textContent = isAll ? 'System Wide Complaints' : `Open in ${location}`;

    document.getElementById('adm-kpi-consumption').textContent = `${(summary.totalConsumption || 0).toLocaleString()} kWh`;
    document.getElementById('adm-kpi-cost').textContent = `₹${(summary.totalCost || 0).toLocaleString()}`;
    document.getElementById('adm-kpi-meters').textContent = summary.activeMetersCount || 0;
    document.getElementById('adm-kpi-complaints').textContent = openComplaintsCount;

    // Charts
    const trend = await API.getTrend({ period, location });
    renderAdminTrendChart(trend.labels, trend.data, period);
    updateTrendDescription('adm', period, location);

    const locationResponse = await API.getLocationWise();
    const locations = locationResponse.locations || [];
    renderAdminLocationChart(
      locations.map(location => location.location),
      locations.map(location => location.consumption)
    );
  } catch (err) {
    console.error('Error loading admin overview:', err);
  }
}

function renderAdminTrendChart(labels, values, period) {
  const canvas = document.getElementById('chart-adm-trend');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (State.charts.admTrend) {
    State.charts.admTrend.destroy();
  }

  State.charts.admTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.map(label => formatTrendLabel(label, period)),
      datasets: [{
        label: 'National Electricity Usage (kWh)',
        data: values,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderWidth: 3,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#f59e0b'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8', callback: v => `${v} kWh` } }
      }
    }
  });
}

function renderAdminLocationChart(locations, data) {
  const canvas = document.getElementById('chart-adm-locations');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (State.charts.admLocation) {
    State.charts.admLocation.destroy();
  }

  State.charts.admLocation = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: locations.map(l => l.split(' - ')[0]), // Short City Name
      datasets: [{
        label: 'Location Load (kWh)',
        data: data,
        backgroundColor: [
          '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f97316'
        ],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8', callback: v => `${v} kWh` } }
      }
    }
  });
}

async function loadAdminComplaints() {
  const tbody = document.getElementById('adm-complaints-tbody');
  if (!tbody) return;

  try {
    const data = await API.getComplaints();
    const complaints = data.complaints || [];

    tbody.innerHTML = complaints.map(c => `
      <tr>
        <td><strong style="color: #fbbf24; font-family: monospace;">${c.complaintId}</strong></td>
        <td>
          <div style="font-weight: 600; color: #fff;">${c.title}</div>
          <small style="color: #94a3b8;">${c.viewerName} (${c.location})</small>
        </td>
        <td>
          <span style="font-size: 0.8rem; color: #cbd5e1;">${c.assignedManagerName || 'Unassigned'}</span>
        </td>
        <td><span class="complaint-status-pill status-${c.status.toLowerCase().replace(/\s+/g, '-')}">${c.status}</span></td>
        <td><span class="priority-pill priority-${c.priority.toLowerCase()}">${c.priority}</span></td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="openAdminComplaintControl('${c._id}')">
            <span>Manage & Reopen</span>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading admin complaints:', err);
  }
}

// Admin Complaint Control Modal
window.openAdminComplaintControl = async function(complaintId) {
  const modal = document.getElementById('modal-adm-complaint');
  if (!modal) return;

  try {
    const data = await API.getComplaint(complaintId);
    const c = data.complaint;

    document.getElementById('adm-cmp-id').textContent = c.complaintId;
    document.getElementById('adm-cmp-title').textContent = c.title;
    document.getElementById('adm-cmp-desc').textContent = c.description;
    document.getElementById('adm-cmp-viewer').textContent = `${c.viewerName} (${c.viewerEmail})`;
    document.getElementById('adm-cmp-loc').textContent = c.location;
    document.getElementById('adm-cmp-status').textContent = c.status;
    document.getElementById('adm-cmp-status').className = `complaint-status-pill status-${c.status.toLowerCase().replace(/\s+/g, '-')}`;

    // Load managers for dropdown
    const usersData = await API.getUsers();
    const managers = (usersData.users || []).filter(u => u.role === 'Manager');
    const mgrSelect = document.getElementById('adm-assign-mgr-select');
    mgrSelect.innerHTML = managers.map(m => `
      <option value="${m._id}" ${c.assignedManagerId === m._id ? 'selected' : ''}>${m.name} (${m.email})</option>
    `).join('');

    document.getElementById('adm-assign-priority-select').value = c.priority;

    // Assignment Form
    const assignForm = document.getElementById('form-adm-assign');
    assignForm.onsubmit = async (e) => {
      e.preventDefault();
      const managerId = mgrSelect.value;
      const priority = document.getElementById('adm-assign-priority-select').value;
      try {
        await API.assignComplaint(c._id, managerId, priority);
        showToast('Complaint assigned successfully', 'success');
        modal.classList.add('hidden');
        await loadAdminComplaints();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    };

    // Reopen button (if resolved or rejected)
    const reopenBox = document.getElementById('adm-reopen-container');
    if (['Resolved', 'Rejected'].includes(c.status)) {
      reopenBox.style.display = 'block';
      const btnReopen = document.getElementById('btn-adm-reopen-case');
      btnReopen.onclick = async () => {
        const reason = document.getElementById('adm-reopen-reason-input').value.trim();
        try {
          await API.reopenComplaint(c._id, reason);
          showToast(`Complaint ${c.complaintId} has been reopened`, 'warning');
          modal.classList.add('hidden');
          await loadAdminComplaints();
        } catch (err) {
          showToast(err.message, 'danger');
        }
      };
    } else {
      reopenBox.style.display = 'none';
    }

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    showToast('Failed to load complaint data', 'danger');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const btnClose = document.getElementById('btn-close-adm-modal');
  const modal = document.getElementById('modal-adm-complaint');
  if (btnClose && modal) {
    btnClose.onclick = () => modal.classList.add('hidden');
  }
});

// Admin User Management
async function loadAdminUsers() {
  const tbody = document.getElementById('adm-users-tbody');
  if (!tbody) return;

  try {
    const data = await API.getUsers();
    const users = data.users || [];

    tbody.innerHTML = users.map(u => `
      <tr>
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td>
          <span class="auth-role-badge badge-${u.role.toLowerCase()}" style="margin: 0; padding: 2px 8px; font-size: 0.72rem;">
            ${u.role}
          </span>
        </td>
        <td><span style="font-size: 0.8rem; color: #cbd5e1;">${(u.assignedLocations || []).join(', ') || 'Global'}</span></td>
        <td>
          <span class="badge ${u.status === 'Active' ? 'badge-active' : 'badge-danger'}">${u.status}</span>
        </td>
        <td>
          ${u.role !== 'Admin' ? `
            <button class="btn btn-sm ${u.status === 'Active' ? 'btn-danger' : 'btn-secondary'}" onclick="toggleUserStatus('${u._id}')">
              ${u.status === 'Active' ? 'Deactivate' : 'Activate'}
            </button>
          ` : '<span style="font-size: 0.75rem; color: #94a3b8;">Protected Root</span>'}
        </td>
      </tr>
    `).join('');

    // Admin is the only role limited to a single account.
    const userForm = document.getElementById('form-adm-create-user');
    if (userForm) {
      const roleSelect = document.getElementById('adm-new-u-role');
      const locationGroup = document.getElementById('adm-new-u-location-group');
      const locationSelect = document.getElementById('adm-new-u-location');

      const updateRoleHelp = () => {
        const isManager = roleSelect.value === 'Manager';
        document.getElementById('adm-new-u-name-label').textContent = isManager ? 'Manager Name' : 'Viewer Name';
        locationGroup.hidden = isManager;
        locationSelect.required = !isManager;
        document.getElementById('adm-new-u-role-help').textContent = isManager
          ? 'Every Manager account has the same access to all locations.'
          : 'Create multiple Viewer accounts as needed.';
        userForm.querySelector('button[type="submit"]').textContent = `Create ${roleSelect.value} Account`;
      };
      roleSelect.onchange = updateRoleHelp;
      updateRoleHelp();

      userForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('adm-new-u-name').value.trim();
        const email = document.getElementById('adm-new-u-email').value.trim();
        const password = document.getElementById('adm-new-u-pwd').value;
        const role = roleSelect.value;
        const location = locationSelect.value;

        try {
          await API.createUser({
            name,
            email,
            password,
            role,
            assignedLocations: role === 'Manager' ? [] : [location]
          });
          showToast(`${role} account ${name} created`, 'success');
          userForm.reset();
          await loadAdminUsers();
        } catch (err) {
          showToast(err.message, 'danger');
        }
      };
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

window.toggleUserStatus = async function(userId) {
  try {
    await API.deactivateUser(userId);
    showToast('User status updated', 'info');
    await loadAdminUsers();
  } catch (err) {
    showToast(err.message, 'danger');
  }
};

async function loadAdminSettings() {
  const form = document.getElementById('form-adm-settings');
  if (!form) return;

  try {
    const data = await API.getSettings();
    const s = data.setting || {};

    document.getElementById('adm-set-high-threshold').value = s.highConsumptionThreshold || 150;
    document.getElementById('adm-set-critical-threshold').value = s.criticalLoadThreshold || 250;
    document.getElementById('adm-set-rate').value = s.electricityRate || 8.5;

    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await API.updateSettings({
          highConsumptionThreshold: parseFloat(document.getElementById('adm-set-high-threshold').value),
          criticalLoadThreshold: parseFloat(document.getElementById('adm-set-critical-threshold').value),
          electricityRate: parseFloat(document.getElementById('adm-set-rate').value)
        });
        showToast('Settings saved successfully', 'success');
      } catch (err) {
        showToast(err.message, 'danger');
      }
    };
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

async function loadAdminLocations() {
  const tbody = document.getElementById('adm-locations-tbody');
  if (!tbody) return;

  try {
    const data = await API.getLocations();
    const locs = data.locations || [];

    tbody.innerHTML = locs.map(l => `
      <tr>
        <td><strong>${escapeHtml(l.name)}</strong></td>
        <td><span style="font-size: 0.82rem; color: #cbd5e1;">${escapeHtml(l.address || 'Indian National Grid Substation')}</span></td>
        <td><span style="color: #22d3ee; font-size: 0.8rem;">${escapeHtml(l.assignedManager || 'Assigned to Manager')}</span></td>
        <td><span class="badge badge-active">${l.meterCount || 0} Active Meters</span></td>
      </tr>
    `).join('');

    const adminLocationSelect = document.getElementById('adm-location-select');
    if (adminLocationSelect) {
      const selectedLocation = State.adminLocation;
      adminLocationSelect.replaceChildren();

      const allOption = document.createElement('option');
      allOption.value = 'all';
      allOption.textContent = 'All Locations';
      adminLocationSelect.appendChild(allOption);

      locs.forEach(location => {
        const option = document.createElement('option');
        option.value = location.name;
        option.textContent = location.name;
        adminLocationSelect.appendChild(option);
      });

      adminLocationSelect.value = locs.some(l => l.name === selectedLocation) ? selectedLocation : 'all';
      State.adminLocation = adminLocationSelect.value;

      const headerLocation = document.getElementById('hdr-user-location');
      if (headerLocation) {
        headerLocation.textContent = State.adminLocation === 'all' ? 'All Locations' : State.adminLocation;
      }
    }

    const locationSelect = document.getElementById('adm-new-u-location');
    if (locationSelect) {
      const selectedLocation = locationSelect.value;
      populateLocationSelect(locationSelect, locs, 'Select a location', selectedLocation);
    }

    const form = document.getElementById('form-adm-create-location');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        try {
          await API.createLocation({
            name: document.getElementById('adm-location-name').value.trim(),
            city: document.getElementById('adm-location-city').value.trim(),
            region: document.getElementById('adm-location-region').value.trim(),
            address: document.getElementById('adm-location-address').value.trim()
          });
          showToast('Location added successfully', 'success');
          form.reset();
          await loadAdminLocations();
        } catch (err) {
          showToast(err.message || 'Failed to add location', 'danger');
        }
      };
    }
  } catch (err) {
    console.error('Error loading locations:', err);
    const locationSelect = document.getElementById('adm-new-u-location');
    if (locationSelect) {
      locationSelect.innerHTML = '<option value="" disabled selected>Unable to load locations</option>';
    }
    showToast(err.message || 'Unable to load locations', 'danger');
  }
}

function populateLocationSelect(select, locations, placeholder, selectedValue = '') {
  select.innerHTML = `<option value="" disabled>${escapeHtml(placeholder)}</option>`;
  if (!locations.length) {
    select.options[0].textContent = 'No locations available';
    select.options[0].selected = true;
    return;
  }
  locations.forEach(location => {
    const option = document.createElement('option');
    option.value = location.name;
    option.textContent = location.name;
    select.appendChild(option);
  });
  select.value = locations.some(location => location.name === selectedValue) ? selectedValue : '';
  if (!select.value) select.options[0].selected = true;
}

async function loadPublicLocations() {
  const select = document.getElementById('reg-location');
  if (!select) return;

  try {
    const data = await API.getPublicLocations();
    populateLocationSelect(select, data.locations || [], 'Select a location');
  } catch (error) {
    select.innerHTML = '<option value="" disabled selected>Unable to load locations</option>';
    console.error('Error loading public locations:', error);
  }
}
