// API URL configuration
// ローカル開発環境でも本番APIを使用
const isDevelopment = import.meta.env.DEV;
const PRODUCTION_API_URL = 'https://alluring-perfection-production-f96d.up.railway.app/api';

// ローカル開発でも本番APIを使用する
export const API_URL = PRODUCTION_API_URL;

console.log('🌐 API Configuration:', {
  mode: isDevelopment ? 'development' : 'production',
  apiUrl: API_URL,
  env: import.meta.env.MODE,
  baseUrl: import.meta.env.BASE_URL
});

// Common API fetch function
export const fetchApi = async (endpoint, options = {}) => {
  // エンドポイントの先頭にスラッシュがない場合は追加
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_URL}${normalizedEndpoint}`;
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
      // エラーオブジェクトにステータスコードを追加
      const error = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }

    // Parse successful response
    const data = await response.json();
    return data;
  } catch (error) {
    // 404エラーの場合はログを出さない（呼び出し側で適切に処理される）
    if (error.status !== 404) {
      console.error(`❌ API Error [${endpoint}]:`, error);
    }
    throw error;
  }
};

// Tournaments API
export const tournamentsApi = {
  getAll: () => fetchApi('tournaments'),
  create: (data) => fetchApi('tournaments', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  update: (id, data) => fetchApi(`tournaments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  delete: (id) => fetchApi(`tournaments/${id}`, {
    method: 'DELETE'
  })
};

// Applicants API
export const applicantsApi = {
  getByTournament: (tournamentId) => fetchApi(`applicants/${tournamentId}`),
  create: (data) => fetchApi('applicants', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  update: (archerId, data) => fetchApi(`applicants/${archerId}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  checkIn: (data) => fetchApi('checkin', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateGender: (archerId, gender) => fetchApi(`applicants/${archerId}/gender`, {
    method: 'PATCH',
    body: JSON.stringify({ gender })
  })
};

// Results API
export const resultsApi = {
  save: (data) => fetchApi('results', {
    method: 'POST',
    body: JSON.stringify(data)
  })
};

// Ranking API
export const rankingApi = {
  // Shichuma (射詰) ranking
  shichuma: {
    get: (tournamentId) => fetchApi(`ranking/shichuma/${tournamentId}`),
    save: (data) => fetchApi('ranking/shichuma', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    saveFinal: (data) => fetchApi('ranking/shichuma/final', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    delete: (tournamentId) => fetchApi(`ranking/shichuma/${tournamentId}`, {
      method: 'DELETE'
    })
  },
  
  // Enkin (遠近) ranking  
  enkin: {
    get: (tournamentId) => fetchApi(`ranking/enkin/${tournamentId}`),
    save: (data) => fetchApi('ranking/enkin', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    saveFinal: (data) => fetchApi('ranking/enkin/final', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    delete: (tournamentId) => fetchApi(`ranking/enkin/${tournamentId}`, {
      method: 'DELETE'
    })
  },
  
  // All shoot-off results
  shootoff: {
    get: (tournamentId) => fetchApi(`ranking/shootoff/${tournamentId}`)
  },
  
  // Clear shoot-off fields
  clear: (tournamentId) => fetchApi(`ranking/clear/${tournamentId}`, {
    method: 'POST'
  })
};

// Health check API
export const healthApi = {
  check: () => fetchApi('health')
};

export default {
  tournaments: tournamentsApi,
  applicants: applicantsApi,
  results: resultsApi,
  ranking: rankingApi,
  health: healthApi
};