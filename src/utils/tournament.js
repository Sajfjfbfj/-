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

  // Process divisions with gender separation settings
  const processedDivisions = (d.divisions || defaultDivisions || []).map(division => ({
    ...division,
    enableGenderSeparation: division.enableGenderSeparation || false,
    id: division.id || `division_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
  }));

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
    divisions: processedDivisions,
    attachments: attachments || [],
    arrowsRound1: d.arrowsRound1 ?? 4,
    arrowsRound2: d.arrowsRound2 ?? 4
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

export const getDivisionForArcher = (archer, tournamentDivisions) => {
  const { ceremony } = (() => {
    const ceremonyRanks = ['錬士', '教士', '範士'];
    let ceremony = '';
    let r = archer.rank || '';
    for (const c of ceremonyRanks) {
      if (r.includes(c)) {
        ceremony = c;
        r = r.replace(c, '');
        break;
      }
    }
    return { ceremony, rank: r };
  })();

  if (ceremony) return 'title';

  const rankOrder = [
    '無指定',
    '五級', '四級', '三級', '弐級', '壱級',
    '初段', '弐段', '参段', '四段', '五段',
    '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段'
  ];

  const normalizeRank = (rank) => {
    if (!rank) return '';
    return rank
      .replace('二段', '弐段')
      .replace('三段', '参段')
      .replace('二級', '弐級')
      .replace('一級', '壱級');
  };

  const normalized = normalizeRank(archer.rank);
  const idx = rankOrder.indexOf(normalized);

  if (Array.isArray(tournamentDivisions) && tournamentDivisions.length > 0) {
    for (const d of tournamentDivisions) {
      if (!d) continue;
      const minR = d.minRank || '';
      const maxR = d.maxRank || '';
      const minIdx = rankOrder.indexOf(normalizeRank(minR));
      const maxIdx = rankOrder.indexOf(normalizeRank(maxR));
      const effectiveMin = minIdx === -1 ? 0 : Math.min(minIdx, rankOrder.length - 1);
      const effectiveMax = maxIdx === -1 ? rankOrder.length - 1 : Math.max(maxIdx, 0);
      if (idx !== -1 && idx >= effectiveMin && idx <= effectiveMax) {
        // If division has gender separation enabled, append gender to division ID
        if (d.enableGenderSeparation && archer.gender) {
          return `${d.id}_${archer.gender}`;
        }
        return d.id;
      }
    }
  }
};
