// Tournament utility functions

export const getLocalDateKey = () => {
  // local date like 2026-01-09
  try {
    return new Date().toLocaleDateString('sv-SE');
  } catch {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
};

export const distanceKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const normalizeTournamentFormData = (data, defaultDivisions, attachments) => {
  const d = data || {};

  return {
    id: d.id || getLocalDateKey(),
    title: d.title || '',
    location: d.location || '',
    date: d.date || getLocalDateKey(),
    description: d.description || '',
    arrowsRound1: parseInt(d.arrowsRound1) || 2,
    arrowsRound2: parseInt(d.arrowsRound2) || 2,
    enableNearFar: d.enableNearFar || false,
    divisions: d.divisions || defaultDivisions,
    awardRankLimit: parseInt(d.awardRankLimit) || 3,
    enableGenderSeparation: d.enableGenderSeparation || false,
    attachments: attachments || []
  };
};

export const getStoredAttachments = (tournamentId) => {
  if (!tournamentId) return [];
  try {
    const raw = localStorage.getItem(`tournamentAttachments:${tournamentId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const setStoredAttachments = (tournamentId, attachments) => {
  if (!tournamentId) return;
  try {
    localStorage.setItem(`tournamentAttachments:${tournamentId}`, JSON.stringify(Array.isArray(attachments) ? attachments : []));
  } catch (error) {
    console.error('Failed to store attachments:', error);
  }
};
