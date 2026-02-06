import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Filter, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import QualifiersView from '../QualifiersView';
import { rankingApi, API_URL } from '../utils/api';
import { getLocalDateKey, getStoredAttachments } from '../utils/tournament';
import { normalizeRank, getRankOrder } from '../utils/competition';

const TournamentView = ({ state, stands, checkInCount }) => {
  const [view, setView] = useState('standings');
  const [selectedTournamentId, setSelectedTournamentId] = useState(() => {
    return localStorage.getItem('selectedTournamentId') || '';
  });
  const [isArcherVerified, setIsArcherVerified] = useState(false);
  const [archerIdInputModal, setArcherIdInputModal] = useState('');
  const [archerIdError, setArcherIdError] = useState('');
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const archersPerPage = 12;
  const programArchersPerPage = 36;
  const [totalPages, setTotalPages] = useState(1);
  const [indexOfFirstArcher, setIndexOfFirstArcher] = useState(0);
  const [indexOfLastArcher, setIndexOfLastArcher] = useState(archersPerPage);
  const [currentArchers, setCurrentArchers] = useState([]);
  const [currentPageProgram, setCurrentPageProgram] = useState(1);
  const [shichumaData, setShichumaData] = useState(null);
  const [isLoadingShichuma, setIsLoadingShichuma] = useState(true);

  useEffect(() => {
    const indexOfLast = currentPage * archersPerPage;
    const indexOfFirst = indexOfLast - archersPerPage;
    setIndexOfFirstArcher(indexOfFirst);
    setIndexOfLastArcher(indexOfLast);
    setCurrentArchers(archers.slice(indexOfFirst, indexOfLast));
    setTotalPages(Math.ceil(archers.length / archersPerPage));
  }, [archers, currentPage, archersPerPage]);

  useEffect(() => {
    setCurrentPageProgram(1);
  }, [selectedTournamentId]);

  useEffect(() => {
    if (selectedTournamentId) {
      localStorage.setItem('selectedTournamentId', selectedTournamentId);
    } else {
      localStorage.removeItem('selectedTournamentId');
    }
  }, [selectedTournamentId]);

  const rankOrder = ['無指定', '五級', '四級', '三級', '弐級', '壱級', '初段', '弐段', '参段', '四段', '五段', '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段'];

  const getRankCategory = (rankStr) => {
    if (!rankStr) return { ceremony: '', rank: '' };
    
    const ceremonyRanks = ['錬士', '教士', '範士'];
    let ceremony = '';
    let rank = rankStr;

    for (const c of ceremonyRanks) {
      if (rankStr.includes(c)) {
        ceremony = c;
        rank = rankStr.replace(c, '');
        break;
      }
    }
    return { ceremony, rank };
  };

  const fetchAndSortArchers = async () => {
    if (!selectedTournamentId) return;

    try {
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const result = await response.json();

      if (result.success) {
        const checkedIn = result.data.filter(a => a.isCheckedIn);
        
        const normalizeRank = (rank) => {
          if (!rank) return '';
          return rank
            .replace('二段', '弐段')
            .replace('三段', '参段')
            .replace('二級', '弐級')
            .replace('一級', '壱級');
        };

        const sortedArchers = [...checkedIn].sort((a, b) => {
          const enableGenderSeparation = state.tournament?.data?.enableGenderSeparation || false;
          if (enableGenderSeparation) {
            const aGender = a.gender || "male";
            const bGender = b.gender || "male";
            if (aGender !== bGender) {
              return aGender === "male" ? -1 : 1;
            }
          }

          const aRank = normalizeRank(a.rank);
          const bRank = normalizeRank(b.rank);
          const aIndex = rankOrder.indexOf(aRank);
          const bIndex = rankOrder.indexOf(bRank);

          if (aIndex !== bIndex) {
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
          }

          const aDate = a.rankAcquiredDate ? new Date(a.rankAcquiredDate) : new Date(0);
          const bDate = b.rankAcquiredDate ? new Date(b.rankAcquiredDate) : new Date(0);
          return aDate.getTime() - bDate.getTime();
        });

        const archersWithOrder = sortedArchers.map((archer, index) => ({
          ...archer,
          standOrder: index + 1
        }));

        setArchers(archersWithOrder);
      }
    } catch (error) {
      console.error('選手データの取得に失敗しました:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleArcherIdSubmit = () => {
    const val = (archerIdInputModal || '').trim();
    if (!val) {
      setArcherIdError('選手IDを入力してください');
      return;
    }
    const pick = state.registeredTournaments.find(t => val.startsWith(t.id));
    if (!pick) {
      setArcherIdError('該当する大会が見つかりません');
      return;
    }
    setSelectedTournamentId(pick.id);
    setIsArcherVerified(true);
    try {
      localStorage.setItem('tournamentViewVerifiedDate', getLocalDateKey());
      localStorage.setItem('tournamentViewVerifiedTournamentId', pick.id);
    } catch {}
    setArcherIdInputModal('');
    setArcherIdError('');
    setIsLoading(true);
    setTimeout(() => { fetchAndSortArchers(); }, 50);
  };

  useEffect(() => {
    if (selectedTournamentId) {
      setIsLoading(true);
      fetchAndSortArchers();
    }
  }, [selectedTournamentId]);

  useEffect(() => {
    try {
      const storedDate = localStorage.getItem('tournamentViewVerifiedDate');
      const storedTournamentId = localStorage.getItem('tournamentViewVerifiedTournamentId');
      const today = getLocalDateKey();
      if (storedDate === today && storedTournamentId) {
        setSelectedTournamentId(storedTournamentId);
        setIsArcherVerified(true);
      } else {
        setIsArcherVerified(false);
      }
    } catch {
      setIsArcherVerified(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedTournamentId || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchAndSortArchers();
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedTournamentId, autoRefresh]);

  useEffect(() => {
    const fetchShichumaResults = async () => {
      if (!selectedTournamentId) return;

      setIsLoadingShichuma(true);
      try {
        const result = await rankingApi.shichuma.get(selectedTournamentId);
        
        if (result.success) {
          setShichumaData(result.data);
        }
      } catch (error) {
        if (error.message?.includes('404') || error.status === 404) {
          setShichumaData(null);
        } else {
          console.error('射詰競射結果の取得エラー:', error);
          setShichumaData(null);
        }
      } finally {
        setIsLoadingShichuma(false);
      }
    };

      fetchShichumaResults();
  }, [selectedTournamentId]);

  const tournament = state.tournament;

  const isPassed = useCallback((archer) => {
    if (!archer.results?.stand1) return null;
    
    const results = archer.results.stand1;
    const currentRound = tournament.currentRound || 1;
    const isFirstRound = currentRound === 1;
    const endIndex = isFirstRound ? tournament.arrowsRound1 : (tournament.arrowsRound1 + tournament.arrowsRound2);
    
    let hitCount = 0;
    let hasNull = false;
    
    for (let i = 0; i < endIndex; i++) {
      if (i >= results.length) {
        hasNull = true;
        break;
      }
      if (results[i] === null) {
        hasNull = true;
        break;
      }
      if (results[i] === 'o') hitCount++;
    }
    
    if (hasNull) return null;
    
    const passRule = tournament.passRule || 'all_four';
    const currentRoundArrows = isFirstRound ? tournament.arrowsRound1 : tournament.arrowsRound2;
    
    if (passRule === 'all_four') {
      return hitCount === currentRoundArrows;
    } else if (passRule === 'four_or_more') {
      return hitCount >= Math.min(4, currentRoundArrows);
    } else if (passRule === 'three_or_more') {
      return hitCount >= Math.min(3, currentRoundArrows);
    } else if (passRule === 'two_or_more') {
      return hitCount >= Math.min(2, currentRoundArrows);
    }
    
    return hitCount === currentRoundArrows;
  }, [tournament]);

  const passedArchers = useMemo(() => {
    return archers.filter(archer => isPassed(archer) === true);
  }, [archers, isPassed]);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const paginateProgram = (pageNumber) => setCurrentPageProgram(pageNumber);

  if (view === 'qualifiers') {
    return (
      <div className="view-container">
        <div className="view-header">
          <button 
            onClick={() => setView('standings')}
            className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> 立ち順表に戻る
          </button>
          <div className="flex justify-between items-center">
            <h1>予選通過者一覧</h1>
            <span className="text-sm text-gray-600">
              {passedArchers.length} / {archers.length} 名
            </span>
          </div>
        </div>
        <div className="view-content">
          <QualifiersView 
            archers={archers} 
            tournament={tournament} 
            getRankCategory={getRankCategory} 
          />
        </div>
      </div>
    );
  }

  if (view === 'shichuma') {
    return (
      <div className="view-container">
        <div className="view-header">
          <button 
            onClick={() => setView('standings')}
            className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> 立ち順表に戻る
          </button>
          <h1>射詰競射結果</h1>
        </div>
        <div className="view-content">
          {isLoadingShichuma ? (
            <div className="card">
              <p className="text-gray-500">読み込み中...</p>
            </div>
          ) : !shichumaData ? (
            <div className="card">
              <p className="text-gray-500">射詰競射の記録がありません</p>
            </div>
          ) : (
            <div className="card">
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  完了日時: {new Date(shichumaData.completedAt).toLocaleString('ja-JP')}
                </p>
              </div>
              
              <div className="space-y-3">
                {shichumaData.results
                  .sort((a, b) => a.rank - b.rank)
                  .map(result => {
                    const archer = archers.find(a => a.archerId === result.archerId);
                    if (!archer) return null;
                    
                    return (
                      <div key={result.archerId} className="border rounded p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-bold text-lg">{result.rank}位</span>
                            <span className="font-semibold ml-3">{archer.name}</span>
                          </div>
                          <span className="text-sm text-gray-600">
                            {result.isWinner 
                              ? `優勝 (継続的中: ${result.consecutiveHits}本)` 
                              : `${result.eliminatedAt}本目で脱落 (継続的中: ${result.consecutiveHits}本)`}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{archer.affiliation}</p>
                        
                        <div className="mt-2 flex gap-1 items-center">
                          <span className="text-xs font-semibold text-gray-500 w-12">記録:</span>
                          <div className="flex gap-1">
                            {result.results.map((r, idx) => (
                              <div key={idx} className="text-center">
                                <span className="text-xs text-gray-500">{idx + 1}本</span>
                                <div className={`w-6 h-6 rounded flex items-center justify-center text-sm font-bold ${
                                  r === 'o' ? 'bg-gray-900 text-white' : 
                                  r === 'x' ? 'bg-red-200 text-red-700' : 'bg-gray-100 text-gray-400'
                                }`}>
                                  {r === 'o' ? '○' : r === 'x' ? '×' : '?'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isArcherVerified) {
    return (
      <div className="view-container">
        <div className="login-container">
          <div className="login-box">
            <div className="login-header">
              <Users size={32} />
              <h1>選手IDで大会を開く</h1>
            </div>
            <p className="hint">受付された選手IDを入力してください（必須）</p>
            <input
              type="text"
              value={archerIdInputModal}
              onChange={(e) => { setArcherIdInputModal(e.target.value); setArcherIdError(''); }}
              onKeyPress={(e) => e.key === 'Enter' && handleArcherIdSubmit()}
              placeholder="選手IDを入力"
              className="input"
            />
            {archerIdError && <p className="error-text">{archerIdError}</p>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleArcherIdSubmit} className="btn-primary">開く</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <h1>大会進行 (リアルタイム)</h1>
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div className="input w-full" style={{ display: 'flex', alignItems: 'center', padding: '0.5rem' }}>
              <span style={{ fontWeight: 600 }}>{(state.registeredTournaments.find(t => t.id === selectedTournamentId)?.data?.name) || (selectedTournamentId ? selectedTournamentId : '-- 大会が選択されていません --')}</span>
            </div>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`btn ${autoRefresh ? 'btn-active' : ''}`}
              style={{ padding: '0.5rem 1rem' }}
            >
              {autoRefresh ? '自動更新ON' : '自動更新OFF'}
            </button>
          </div>
        </div>
      </div>

      <div className="view-content">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setView('standings')}
            className={`btn ${view === 'standings' ? 'btn-active' : ''}`}
          >
            立ち順表
          </button>
          <button
            onClick={() => setView('qualifiers')}
            className={`btn ${view === 'qualifiers' ? 'btn-active' : ''}`}
          >
            予選通過者
          </button>
          <button
            onClick={() => setView('shichuma')}
            className={`btn ${view === 'shichuma' ? 'btn-active' : ''}`}
          >
            射詰競射
          </button>
        </div>

        <div className="card">
          <div className="table-responsive">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">氏名</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">所属</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">段位</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">性別</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">1立ち目</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">2立ち目</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">結果</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading && archers.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-4 text-center text-sm text-gray-500">
                      読み込み中...
                    </td>
                  </tr>
                ) : archers.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-4 text-center text-sm text-gray-500">
                      受付済みの選手がいません
                    </td>
                  </tr>
                ) : (
                  <>
                    {(() => {
                      const enableGenderSeparation = tournament?.data?.enableGenderSeparation || false;
                      
                      if (enableGenderSeparation) {
                        const maleArchers = currentArchers.filter(a => (a.gender || 'male') === 'male');
                        const femaleArchers = currentArchers.filter(a => a.gender === 'female');
                        
                        return (
                          <>
                            {maleArchers.length > 0 && (
                              <>
                                <tr>
                                  <td colSpan="8" className="px-4 py-2 bg-blue-50 text-center font-medium text-blue-700">
                                    男部門
                                  </td>
                                </tr>
                                {maleArchers.map((archer) => {
                                  const { ceremony, rank } = getRankCategory(archer.rank);
                                  const stand1Result = archer.results?.stand1?.slice(0, tournament.arrowsRound1) || Array(tournament.arrowsRound1).fill(null);
                                  const stand2Result = archer.results?.stand1?.slice(tournament.arrowsRound1, tournament.arrowsRound1 + tournament.arrowsRound2) || Array(tournament.arrowsRound2).fill(null);
                                  const passed = isPassed(archer);
                                  
                                  return (
                                    <tr 
                                      key={archer.archerId} 
                                      className={`${passed ? 'bg-green-50' : ''} hover:bg-gray-50`}
                                    >
                                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {archer.standOrder}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex items-center">
                                          <span className="font-medium">{archer.name}</span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                        {archer.affiliation}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                                        {ceremony}{rank}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                                        男
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex gap-1 justify-center">
                                          {stand1Result.map((result, idx) => (
                                            <span 
                                              key={idx} 
                                              className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${
                                                result === 'o' ? 'bg-gray-900 text-white' : 
                                                result === 'x' ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-400'
                                              }`}
                                            >
                                              {result === 'o' ? '◯' : result === 'x' ? '×' : '?'}
                                            </span>
                                          ))}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex gap-1 justify-center">
                                          {stand2Result.map((result, idx) => (
                                            <span 
                                              key={idx} 
                                              className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${
                                                result === 'o' ? 'bg-gray-900 text-white' : 
                                                result === 'x' ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-400'
                                              }`}
                                            >
                                              {result === 'o' ? '◯' : result === 'x' ? '×' : '?'}
                                            </span>
                                          ))}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-center">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                          passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                          {passed ? '合格' : '不合格'}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </>
                            )}
                            
                            {femaleArchers.length > 0 && (
                              <>
                                <tr>
                                  <td colSpan="8" className="px-4 py-2 bg-pink-50 text-center font-medium text-pink-700">
                                    女部門
                                  </td>
                                </tr>
                                {femaleArchers.map((archer) => {
                                  const { ceremony, rank } = getRankCategory(archer.rank);
                                  const stand1Result = archer.results?.stand1?.slice(0, tournament.arrowsRound1) || Array(tournament.arrowsRound1).fill(null);
                                  const stand2Result = archer.results?.stand1?.slice(tournament.arrowsRound1, tournament.arrowsRound1 + tournament.arrowsRound2) || Array(tournament.arrowsRound2).fill(null);
                                  const passed = isPassed(archer);
                                  
                                  return (
                                    <tr 
                                      key={archer.archerId} 
                                      className={`${passed ? 'bg-green-50' : ''} hover:bg-gray-50`}
                                    >
                                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {archer.standOrder}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex items-center">
                                          <span className="font-medium">{archer.name}</span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                        {archer.affiliation}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                                        {ceremony}{rank}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                                        女
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex gap-1 justify-center">
                                          {stand1Result.map((result, idx) => (
                                            <span 
                                              key={idx} 
                                              className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${
                                                result === 'o' ? 'bg-gray-900 text-white' : 
                                                result === 'x' ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-400'
                                              }`}
                                            >
                                              {result === 'o' ? '◯' : result === 'x' ? '×' : '?'}
                                            </span>
                                          ))}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex gap-1 justify-center">
                                          {stand2Result.map((result, idx) => (
                                            <span 
                                              key={idx} 
                                              className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${
                                                result === 'o' ? 'bg-gray-900 text-white' : 
                                                result === 'x' ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-400'
                                              }`}
                                            >
                                              {result === 'o' ? '◯' : result === 'x' ? '×' : '?'}
                                            </span>
                                          ))}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-center">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                          passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                          {passed ? '合格' : '不合格'}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </>
                            )}
                          </>
                        );
                      } else {
                        return currentArchers.map((archer) => {
                          const { ceremony, rank } = getRankCategory(archer.rank);
                          const stand1Result = archer.results?.stand1?.slice(0, tournament.arrowsRound1) || Array(tournament.arrowsRound1).fill(null);
                          const stand2Result = archer.results?.stand1?.slice(tournament.arrowsRound1, tournament.arrowsRound1 + tournament.arrowsRound2) || Array(tournament.arrowsRound2).fill(null);
                          const passed = isPassed(archer);
                          
                          return (
                            <tr 
                              key={archer.archerId} 
                              className={`${passed ? 'bg-green-50' : ''} hover:bg-gray-50`}
                            >
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {archer.standOrder}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center">
                                  <span className="font-medium">{archer.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {archer.affiliation}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                                {ceremony}{rank}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                                {archer.gender === 'female' ? '女' : '男'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex gap-1 justify-center">
                                  {stand1Result.map((result, idx) => (
                                    <span 
                                      key={idx} 
                                      className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${
                                        result === 'o' ? 'bg-gray-900 text-white' : 
                                        result === 'x' ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-400'
                                      }`}
                                    >
                                      {result === 'o' ? '◯' : result === 'x' ? '×' : '?'}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex gap-1 justify-center">
                                  {stand2Result.map((result, idx) => (
                                    <span 
                                      key={idx} 
                                      className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${
                                        result === 'o' ? 'bg-gray-900 text-white' : 
                                        result === 'x' ? 'bg-gray-200 text-gray-600' : 'bg-gray-100 text-gray-400'
                                      }`}
                                    >
                                      {result === 'o' ? '◯' : result === 'x' ? '×' : '?'}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                {passed === true && (
                                  <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">
                                    合格
                                  </span>
                                )}
                                {passed === false && (
                                  <span className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-full">
                                    不合格
                                  </span>
                                )}
                                {passed === null && (
                                  <span className="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full">
                                    記録中
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      }
                    })()}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {archers.length > archersPerPage && (
            <div className="flex items-center justify-between mt-4">
              <div>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{indexOfFirstArcher + 1}</span> ? <span className="font-medium">
                    {Math.min(indexOfLastArcher, archers.length)}
                  </span> / <span className="font-medium">{archers.length}</span> 名
                </p>
              </div>
              <div className="flex space-x-1">
                <button onClick={() => paginate(Math.max(1, currentPage-1))} disabled={currentPage === 1} className="btn">前へ</button>
                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button key={i} onClick={() => paginate(i+1)} className={`btn ${currentPage === i+1 ? 'btn-active' : ''}`}>{i+1}</button>
                  ))}
                </div>
                <button onClick={() => paginate(Math.min(totalPages, currentPage+1))} disabled={currentPage === totalPages} className="btn">次へ</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentView;
