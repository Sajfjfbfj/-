// API URL configuration
const API_BASE_URL = 'https://alluring-perfection-production-f96d.up.railway.app/api';
export const API_URL = API_BASE_URL.startsWith('http') 
  ? API_BASE_URL 
  : `${window.location.origin}${API_BASE_URL.startsWith('/') ? '' : '/'}${API_BASE_URL}`;

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

  const response = await fetch(url, config);
  return response.json();
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
