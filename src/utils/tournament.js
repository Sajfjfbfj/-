// Tournament utility functions

export const getLocalDateKey = () => {
  // Get current date in Japanese timezone (JST, UTC+9)
  try {
    const now = new Date();
    // Use Japanese locale to ensure we get the correct date for JST
    const jstDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const y = jstDate.getFullYear();
    const m = String(jstDate.getMonth() + 1).padStart(2, '0');
    const day = String(jstDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    // Fallback to local date if timezone conversion fails
    try {
      return new Date().toLocaleDateString('sv-SE');
    } catch {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
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
    name: d.name || '',
    datetime: d.datetime || '',
    location: d.location || '',
    venueAddress: d.venueAddress || '',
    venueLat: d.venueLat || '',
    venueLng: d.venueLng || '',
    organizer: d.organizer || '',
    coOrganizer: d.coOrganizer || '',
    administrator: d.administrator || '',
    purpose: d.purpose || '',
    event: d.event || '',
    type: d.type || '',
    category: d.category || '',
    description: d.description || '',
    competitionMethod: d.competitionMethod || '',
    award: d.award || '',
    qualifications: d.qualifications || '',
    applicableRules: d.applicableRules || '',
    applicationMethod: d.applicationMethod || '',
    remarks: d.remarks || '',
    enableGenderSeparation: d.enableGenderSeparation || false,
    divisions: d.divisions || defaultDivisions,
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
