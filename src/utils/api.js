// API URL configuration
// 開発環境ではVite proxyを使用し、本番環境では直接URLを使用
const isDevelopment = import.meta.env.DEV;
const PRODUCTION_API_URL = 'https://alluring-perfection-production-f96d.up.railway.app/api';

export const API_URL = isDevelopment ? '/api' : PRODUCTION_API_URL;

console.log('🌐 API Configuration:', {
  mode: isDevelopment ? 'development' : 'production',
  apiUrl: API_URL
});

// Common API fetch function
export const fetchApi = async (endpoint, options = {}) => {
  const url = `${API_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    // Check if response is ok
    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // If JSON parsing fails, try to get text
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch {
          // Use default error message
        }
      }
      throw new Error(errorMessage);
    }

    // Parse successful response
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`❌ API Error [${endpoint}]:`, error);
    throw error;
  }
};

// Tournaments API
export const tournamentsApi = {
  getAll: () => fetchApi('/tournaments'),
  create: (data) => fetchApi('/tournaments', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  update: (id, data) => fetchApi(`/tournaments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  delete: (id) => fetchApi(`/tournaments/${id}`, {
    method: 'DELETE'
  })
};

// Applicants API
export const applicantsApi = {
  getByTournament: (tournamentId) => fetchApi(`/applicants/${tournamentId}`),
  create: (data) => fetchApi('/applicants', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  update: (archerId, data) => fetchApi(`/applicants/${archerId}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  checkIn: (data) => fetchApi('/checkin', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateGender: (archerId, gender) => fetchApi(`/applicants/${archerId}/gender`, {
    method: 'PATCH',
    body: JSON.stringify({ gender })
  })
};

// Results API
export const resultsApi = {
  save: (data) => fetchApi('/results', {
    method: 'POST',
    body: JSON.stringify(data)
  })
};

// Ranking API
export const rankingApi = {
  // Shichuma (射詰) ranking
  shichuma: {
    get: (tournamentId) => fetchApi(`/ranking/shichuma/${tournamentId}`),
    save: (data) => fetchApi('/ranking/shichuma', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    saveFinal: (data) => fetchApi('/ranking/shichuma/final', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    delete: (tournamentId) => fetchApi(`/ranking/shichuma/${tournamentId}`, {
      method: 'DELETE'
    })
  },
  
  // Enkin (遠近) ranking  
  enkin: {
    get: (tournamentId) => fetchApi(`/ranking/enkin/${tournamentId}`),
    save: (data) => fetchApi('/ranking/enkin', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    saveFinal: (data) => fetchApi('/ranking/enkin/final', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    delete: (tournamentId) => fetchApi(`/ranking/enkin/${tournamentId}`, {
      method: 'DELETE'
    })
  },
  
  // All shoot-off results
  shootoff: {
    get: (tournamentId) => fetchApi(`/ranking/shootoff/${tournamentId}`)
  },
  
  // Clear shoot-off fields
  clear: (tournamentId) => fetchApi(`/ranking/clear/${tournamentId}`, {
    method: 'POST'
  })
};

// Health check API
export const healthApi = {
  check: () => fetchApi('/health')
};

export default {
  tournaments: tournamentsApi,
  applicants: applicantsApi,
  results: resultsApi,
  ranking: rankingApi,
  health: healthApi
};