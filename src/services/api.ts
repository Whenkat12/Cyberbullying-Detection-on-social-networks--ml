// API service for backend communication
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('token');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  // Set authentication token
  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  setRefreshToken(refreshToken) {
    this.refreshToken = refreshToken;
    localStorage.setItem('refreshToken', refreshToken);
  }

  // Clear authentication
  clearAuth() {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  }

  // Make API request
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add authentication token if available
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle token refresh if needed
      if (response.status === 401 && this.refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry the original request with new token
          headers['Authorization'] = `Bearer ${this.token}`;
          return fetch(url, {
            ...options,
            headers,
          }).then(res => this.handleResponse(res));
        }
      }

      return this.handleResponse(response);
    } catch (error) {
      console.error('API request failed:', error);
      throw new Error('Network error. Please check your connection.');
    }
  }

  // Handle API response
  async handleResponse(response) {
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.message || 'API request failed');
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  // Refresh access token
  async refreshAccessToken() {
    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.setToken(data.token);
        this.setRefreshToken(data.refreshToken);
        return true;
      }

      // Refresh failed, clear auth
      this.clearAuth();
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearAuth();
      return false;
    }
  }

  // Authentication endpoints
  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async login(credentials) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  async logout() {
    const result = await this.request('/auth/logout', {
      method: 'POST',
    });
    this.clearAuth();
    return result;
  }

  // User endpoints
  async getUserProfile() {
    return this.request('/users/profile');
  }

  async updateProfile(profileData) {
    return this.request('/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(profileData),
    });
  }

  async updateSettings(settingsData) {
    return this.request('/users/settings', {
      method: 'PATCH',
      body: JSON.stringify(settingsData),
    });
  }

  async changePassword(passwordData) {
    return this.request('/users/password', {
      method: 'PATCH',
      body: JSON.stringify(passwordData),
    });
  }

  async getUserStats(timeRange = 30) {
    return this.request(`/users/stats?timeRange=${timeRange}`);
  }

  async getUserActivity(page = 1, limit = 20) {
    return this.request(`/users/activity?page=${page}&limit=${limit}`);
  }

  async deleteAccount(passwordData) {
    return this.request('/users/account', {
      method: 'DELETE',
      body: JSON.stringify(passwordData),
    });
  }

  // Detection endpoints
  async detectCyberbullying(text, context = {}, isRealTime = false) {
    return this.request('/detections/detect', {
      method: 'POST',
      body: JSON.stringify({
        text,
        context,
        isRealTime,
      }),
    });
  }

  async batchDetect(texts, context = {}, isRealTime = false) {
    return this.request('/detections/batch-detect', {
      method: 'POST',
      body: JSON.stringify({
        texts: texts.map(text => ({ text })),
        context,
        isRealTime,
      }),
    });
  }

  async getDetectionHistory(page = 1, limit = 20, filters = {}) {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...filters,
    });
    
    return this.request(`/detections/history?${queryParams}`);
  }

  async getDetection(id) {
    return this.request(`/detections/${id}`);
  }

  async updateDetectionFeedback(id, feedback) {
    return this.request(`/detections/${id}/feedback`, {
      method: 'PATCH',
      body: JSON.stringify(feedback),
    });
  }

  async getDetectionStats(timeRange = 30) {
    return this.request(`/detections/stats/overview?timeRange=${timeRange}`);
  }

  async getTrendingWords(timeRange = 7) {
    return this.request(`/detections/stats/trending?timeRange=${timeRange}`);
  }

  async exportDetections(format = 'csv', timeRange = 30) {
    return this.request(`/detections/export/${format}?timeRange=${timeRange}`);
  }

  // Chat endpoints
  async getChats(status = 'all', platform = null) {
    const queryParams = new URLSearchParams({ status });
    if (platform) queryParams.append('platform', platform);
    
    return this.request(`/chats?${queryParams}`);
  }

  async getChat(id) {
    return this.request(`/chats/${id}`);
  }

  async createChat(chatData) {
    return this.request('/chats', {
      method: 'POST',
      body: JSON.stringify(chatData),
    });
  }

  async updateChatSettings(id, settings) {
    return this.request(`/chats/${id}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  }

  async blockChat(id, reason) {
    return this.request(`/chats/${id}/block`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async unblockChat(id) {
    return this.request(`/chats/${id}/unblock`, {
      method: 'POST',
    });
  }

  async deleteChat(id) {
    return this.request(`/chats/${id}`, {
      method: 'DELETE',
    });
  }

  async getChatStats(id) {
    return this.request(`/chats/${id}/stats`);
  }

  // Message endpoints
  async getMessages(chatId, page = 1, limit = 50) {
    return this.request(`/messages/chat/${chatId}?page=${page}&limit=${limit}`);
  }

  async sendMessage(chatId, text, sender = 'user', metadata = {}) {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify({
        chatId,
        text,
        sender,
        metadata,
      }),
    });
  }

  async getMessage(id) {
    return this.request(`/messages/${id}`);
  }

  async updateMessageFeedback(id, feedback) {
    return this.request(`/messages/${id}/feedback`, {
      method: 'PATCH',
      body: JSON.stringify(feedback),
    });
  }

  async blockMessage(id, reason) {
    return this.request(`/messages/${id}/block`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getMessagesForReview(severity, platform, limit = 20) {
    const queryParams = new URLSearchParams({ limit: limit.toString() });
    if (severity) queryParams.append('severity', severity);
    if (platform) queryParams.append('platform', platform);
    
    return this.request(`/messages/review/pending?${queryParams}`);
  }

  async batchProcessMessages(messages) {
    return this.request('/messages/batch-process', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    });
  }

  // Analytics endpoints
  async getAnalyticsOverview(timeRange = 30) {
    return this.request(`/analytics/overview?timeRange=${timeRange}`);
  }

  async getDetailedAnalytics(timeRange = 30) {
    return this.request(`/analytics/detailed?timeRange=${timeRange}`);
  }

  async getComparativeAnalytics(timeRange = 30) {
    return this.request(`/analytics/comparative?timeRange=${timeRange}`);
  }

  async getPredictiveAnalytics() {
    return this.request('/analytics/predictive');
  }

  // ML Model endpoints
  async getModelInfo() {
    return this.request('/ml/model');
  }

  async getVocabulary(page = 1, limit = 100) {
    return this.request(`/ml/vocabulary?page=${page}&limit=${limit}`);
  }

  async searchVocabulary(query, limit = 50) {
    return this.request(`/ml/vocabulary/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  async getTopBullyingWords(limit = 100) {
    return this.request(`/ml/vocabulary/top-bullying?limit=${limit}`);
  }

  async retrainModel() {
    return this.request('/ml/retrain', {
      method: 'POST',
    });
  }

  async updateModel(trainingData) {
    return this.request('/ml/update', {
      method: 'POST',
      body: JSON.stringify({ trainingData }),
    });
  }

  async testDetection(text) {
    return this.request('/ml/test', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  async getModelPerformance() {
    return this.request('/ml/performance');
  }

  // Health check
  async checkHealth() {
    return this.request('/health');
  }
}

// Create singleton instance
export const apiService = new ApiService();

export default ApiService;