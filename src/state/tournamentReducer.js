export const initialTournamentState = {
  tournament: {
    id: 'KYUDO_2024_0001',
    name: '第◯回◯◯弓道大会',
    date: '2024年12月29日',
    stage: 'qualifiers',
    passRule: 'all_four',
    arrowsRound1: 2,
    arrowsRound2: 4,
    currentRound: 1,
    archersPerStand: 12,
  },
  registeredTournaments: [],
  applicants: [],
  archers: [],
};

export function tournamentReducer(state, action) {
  switch (action.type) {
    case 'LOAD_TOURNAMENTS':
      return { ...state, registeredTournaments: action.payload.map(t => ({ id: t.id, data: t.data })) };
    case 'UPDATE_TOURNAMENT_INFO':
      return { ...state, tournament: { ...state.tournament, ...action.payload } };
    case 'SAVE_TOURNAMENT_TEMPLATE': {
      const updated = state.registeredTournaments.filter(t => t.id !== action.payload.id);
      return { ...state, registeredTournaments: [...updated, action.payload] };
    }
    case 'DELETE_TOURNAMENT_TEMPLATE':
      return { ...state, registeredTournaments: state.registeredTournaments.filter(t => t.id !== action.payload) };
    case 'RESET_ALL':
      return initialTournamentState;
    default:
      return state;
  }
}
