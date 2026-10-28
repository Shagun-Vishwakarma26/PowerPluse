/**
 * PowerPulse REST API Client
 */
const API_BASE = '/api';

const API = {
  getToken() {
    return localStorage.getItem('powerpulse_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('powerpulse_token', token);
    } else {
      localStorage.removeItem('powerpulse_token');
    }
  },

  getCurrentUser() {
    try {
      const u = localStorage.getItem('powerpulse_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  },

  setCurrentUser(user) {
    if (user) {
      localStorage.setItem('powerpulse_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('powerpulse_user');
    }
  },

  clearAuth() {
    localStorage.removeItem('powerpulse_token');
    localStorage.removeItem('powerpulse_user');
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 && !endpoint.includes('/auth/login')) {
          // Token expired or invalid
          this.clearAuth();
          if (!window.location.pathname.includes('login') && !window.location.pathname.endsWith('index.html')) {
            window.location.href = '/index.html';
          }
        }
        throw new Error(data.message || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error.message);
      throw error;
    }
  },

  // --- AUTHENTICATION ---
  async login(email, password, expectedRole) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: { email, password, expectedRole }
    });
    if (data.token) {
      this.setToken(data.token);
      this.setCurrentUser(data.user);
    }
    return data;
  },

  async registerViewer(name, email, password, location) {
    const data = await this.request('/auth/register-viewer', {
      method: 'POST',
      body: { name, email, password, location }
    });
    if (data.token) {
      this.setToken(data.token);
      this.setCurrentUser(data.user);
    }
    return data;
  },

  async getMe() {
    const res = await this.request('/auth/me');
    if (res.user) {
      this.setCurrentUser(res.user);
    }
    return res;
  },

  async updateProfile(name) {
    return await this.request('/auth/profile', {
      method: 'PUT',
      body: { name }
    });
  },

  async changePassword(currentPassword, newPassword) {
    return await this.request('/auth/change-password', {
      method: 'PUT',
      body: { currentPassword, newPassword }
    });
  },

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Continue client cleanup even if network fails
    }
    this.clearAuth();
  },

  async getDemoAccounts() {
    return await this.request('/auth/demo-accounts');
  },

  async getPublicLocations() {
    return await this.request('/auth/locations');
  },

  // --- COMPLAINTS & TICKETS ---
  async getComplaints(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`/complaints?${query}`);
  },

  async getComplaint(id) {
    return await this.request(`/complaints/${id}`);
  },

  async createComplaint(complaintData) {
    return await this.request('/complaints', {
      method: 'POST',
      body: complaintData
    });
  },

  async updateComplaintStatus(id, status, managerResponse, resolutionDetails) {
    return await this.request(`/complaints/${id}/status`, {
      method: 'PUT',
      body: { status, managerResponse, resolutionDetails }
    });
  },

  async assignComplaint(id, managerId, priority) {
    return await this.request(`/complaints/${id}/assign`, {
      method: 'PUT',
      body: { managerId, priority }
    });
  },

  async reopenComplaint(id, reason) {
    return await this.request(`/complaints/${id}/reopen`, {
      method: 'PUT',
      body: { reason }
    });
  },

  async sendComplaintMessage(id, message) {
    return await this.request(`/complaints/${id}/messages`, {
      method: 'POST',
      body: { message }
    });
  },

  // --- NOTIFICATIONS ---
  async getNotifications() {
    return await this.request('/notifications');
  },

  async getUnreadCount() {
    return await this.request('/notifications/unread-count');
  },

  async markNotificationRead(id) {
    return await this.request(`/notifications/${id}/read`, {
      method: 'PUT'
    });
  },

  async markAllNotificationsRead() {
    return await this.request('/notifications/read-all', {
      method: 'PUT'
    });
  },

  // --- ANALYTICS & OVERVIEWS ---
  async getSummary(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`/analytics/summary?${query}`);
  },

  async getTrend(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`/analytics/trend?${query}`);
  },

  async getLocationWise() {
    return await this.request('/analytics/location-wise');
  },

  async getHourly() {
    return await this.request('/analytics/hourly');
  },

  async getViewerOverview() {
    return await this.request('/analytics/viewer-overview');
  },

  // --- READINGS & TELEMETRY ---
  async getReadings(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`/readings?${query}`);
  },

  async createReading(readingData) {
    return await this.request('/readings', {
      method: 'POST',
      body: readingData
    });
  },

  async deleteReading(id) {
    return await this.request(`/readings/${id}`, {
      method: 'DELETE'
    });
  },

  // --- LOCATIONS ---
  async getLocations() {
    return await this.request('/locations');
  },

  async createLocation(data) {
    return await this.request('/locations', {
      method: 'POST',
      body: data
    });
  },

  async updateLocation(id, data) {
    return await this.request(`/locations/${id}`, {
      method: 'PUT',
      body: data
    });
  },

  async deleteLocation(id) {
    return await this.request(`/locations/${id}`, {
      method: 'DELETE'
    });
  },

  // --- METERS ---
  async getMeters(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`/meters?${query}`);
  },

  async createMeter(data) {
    return await this.request('/meters', {
      method: 'POST',
      body: data
    });
  },

  async updateMeter(id, data) {
    return await this.request(`/meters/${id}`, {
      method: 'PUT',
      body: data
    });
  },

  async deleteMeter(id) {
    return await this.request(`/meters/${id}`, {
      method: 'DELETE'
    });
  },

  // --- ALERTS ---
  async getAlerts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`/alerts?${query}`);
  },

  async updateAlertStatus(id, status) {
    return await this.request(`/alerts/${id}/status`, {
      method: 'PUT',
      body: { status }
    });
  },

  // --- USERS (Admin) ---
  async getUsers() {
    return await this.request('/users');
  },

  async getManagers() {
    return await this.request('/users/managers');
  },

  async createUser(data) {
    return await this.request('/users', {
      method: 'POST',
      body: data
    });
  },

  async updateUser(id, data) {
    return await this.request(`/users/${id}`, {
      method: 'PUT',
      body: data
    });
  },

  async toggleUserStatus(id) {
    return await this.request(`/users/${id}/toggle-status`, {
      method: 'PUT'
    });
  },

  async deleteUser(id) {
    return await this.request(`/users/${id}`, {
      method: 'DELETE'
    });
  },

  // --- SETTINGS ---
  async getSettings() {
    return await this.request('/settings');
  },

  async updateSettings(data) {
    return await this.request('/settings', {
      method: 'PUT',
      body: data
    });
  }
};

window.API = API;
