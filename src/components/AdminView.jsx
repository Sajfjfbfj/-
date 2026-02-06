import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Lock, LogOut, RotateCcw, Copy, Check, QrCode, Maximize2, Filter, X, User, Camera, RefreshCw, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import QRCodeScanner from './QRCodeScanner';
import AwardsView from './AwardsView';
import { tournamentsApi, applicantsApi, resultsApi, rankingApi, API_URL } from '../utils/api';
import { 
  getLocalDateKey, 
  distanceKm, 
  normalizeTournamentFormData, 
  getStoredAttachments, 
  setStoredAttachments 
} from '../utils/tournament';
import { 
  judgeNearFarCompetition, 
  calculateRanksWithTies,
  normalizeRank,
  getRankOrder,
  getRankIndex,
  getDivisionIdForArcher
} from '../utils/competition';

const AdminView = ({ state, dispatch, adminView, setAdminView, stands, selectedTournamentId, setSelectedTournamentId, onLogout }) => {
  const [selectedDivision, setSelectedDivision] = useState(() => localStorage.getItem('recording_selectedDivision') || '');
  const [selectedStand, setSelectedStand] = useState(() => parseInt(localStorage.getItem('recording_selectedStand')) || 1);
  const [selectedRound, setSelectedRound] = useState(() => parseInt(localStorage.getItem('recording_selectedRound')) || 1);
  const [selectedGender, setSelectedGender] = useState(() => localStorage.getItem('recording_selectedGender') || 'all');
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingArrow, setEditingArrow] = useState(null);
  const [message, setMessage] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannedQR, setScannedQR] = useState('');
  const [currentQRCodeData, setCurrentQRCodeData] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [geoStatus, setGeoStatus] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  useEffect(() => { localStorage.setItem('recording_selectedDivision', selectedDivision || ''); }, [selectedDivision]);
  useEffect(() => { localStorage.setItem('recording_selectedStand', selectedStand); }, [selectedStand]);
  useEffect(() => { localStorage.setItem('recording_selectedRound', selectedRound); }, [selectedRound]);
  useEffect(() => { localStorage.setItem('recording_selectedGender', selectedGender || 'all'); }, [selectedGender]);

  const tournament = state.tournament;
  const rankOrder = ['無指定', '五級', '四級', '三級', '弐級', '壱級', '初段', '弐段', '参段', '四段', '五段', '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段'];

  const normalizeRank = (rank) => {
    if (!rank) return '';
    return rank
      .replace('二段', '弐段')
      .replace('三段', '参段')
      .replace('二級', '弐級')
      .replace('一級', '壱級');
  };

  const getDivisionIdsForArcher = (archer, divisions) => {
    const rIdx = rankOrder.indexOf(normalizeRank(archer?.rank));
    const matchingDivisions = [];
    for (const d of (divisions || [])) {
      const minIdx = d?.minRank ? rankOrder.indexOf(normalizeRank(d.minRank)) : 0;
      const maxIdx = d?.maxRank ? rankOrder.indexOf(normalizeRank(d.maxRank)) : rankOrder.length - 1;
      if (rIdx >= minIdx && rIdx <= maxIdx) {
        matchingDivisions.push(d.id);
      }
    }
    return matchingDivisions.length > 0 ? matchingDivisions : ['unassigned'];
  };

  const getDivisionIdForArcher = (archer, divisions) => {
    const divisionIds = getDivisionIdsForArcher(archer, divisions);
    return divisionIds[0] || 'unassigned';
  };
   
  const getCurrentArrowsPerStand = () => {
    return selectedRound === 1 ? tournament.arrowsRound1 : tournament.arrowsRound2;
  };

  const defaultDivisions = [
    { id: 'lower', label: '級位~三段以下の部', minRank: '五級', maxRank: '参段' },
    { id: 'middle', label: '四・五段の部', minRank: '四段', maxRank: '五段' },
    { id: 'title', label: '称号者の部', minRank: '錬士五段', maxRank: '範士九段' }
  ];

  const tournaments = state.registeredTournaments || [];
  const selectedTournament = tournaments.find(t => t.id === selectedTournamentId) || null;
  const divisions = (selectedTournament && selectedTournament.data && selectedTournament.data.divisions) ? selectedTournament.data.divisions : defaultDivisions;
  const enableGenderSeparation = selectedTournament?.data?.enableGenderSeparation || false;

  const fetchAndSortArchers = async (forceRefresh = false) => {
    if (!selectedTournamentId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const result = await response.json();

      if (result.success) {
        const checkedIn = result.data.filter(a => a.isCheckedIn);
        
        const defaultResults = {};
        for (let s = 1; s <= 6; s++) {
          defaultResults[`stand${s}`] = Array(tournament.arrowsRound1 + tournament.arrowsRound2).fill(null);
        }

        const sortedArchers = [...checkedIn].sort((a, b) => {
          const enableGenderSeparation = tournament?.data?.enableGenderSeparation || false;
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
          standOrder: index + 1,
          division: getDivisionIdForArcher(archer, divisions),
          results: Object.assign({}, defaultResults, archer.results || {})
        }));

        setArchers(archersWithOrder);
        
        if (!selectedDivision && archersWithOrder.length > 0) {
          const firstArcherDivision = getDivisionIdForArcher(archersWithOrder[0], divisions);
          setSelectedDivision(firstArcherDivision);
        }
      }
    } catch (error) {
      console.error('選手データの取得に失敗しました:', error);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (selectedTournamentId) {
      fetchAndSortArchers();
    }
  }, [selectedTournamentId]);

  useEffect(() => {
    if (selectedTournamentId && archers.length > 0) {
      fetchAndSortArchers(true);
    }
  }, [divisions]);

  useEffect(() => {
    if (!selectedTournamentId) return;
    const interval = setInterval(() => {
      setIsSyncing(true);
      fetchAndSortArchers(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedTournamentId]);

  const filteredTournaments = state.registeredTournaments;
  const divisionArchers = archers.filter(a => {
    const archerDivisions = getDivisionIdsForArcher(a, divisions);
    if (!archerDivisions.includes(selectedDivision)) return false;
    if (!enableGenderSeparation) return true;
    if (selectedGender === 'all') return true;
    const g = (a.gender || 'male');
    if (selectedGender === 'male') return g === 'male';
    if (selectedGender === 'female') return g === 'female';
    return true;
  });

  const getArchersForStand = (standNumber) => {
    const archersPerStand = tournament.archersPerStand;
    const startIndex = (standNumber - 1) * archersPerStand;
    const endIndex = startIndex + archersPerStand;
    return divisionArchers.slice(startIndex, endIndex);
  };

  const handleArrowClick = (archerId, standNumber, arrowIndex) => {
    setEditingArrow({ archerId, standNumber, arrowIndex });
  };

  const handleArrowResult = async (archerId, standNumber, arrowIndex, result) => {
    try {
      const response = await fetch(`${API_URL}/results/${selectedTournamentId}/${archerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stand: standNumber,
          arrowIndex,
          result
        })
      });

      if (response.ok) {
        await fetchAndSortArchers(true);
        setEditingArrow(null);
      } else {
        setMessage('記録の保存に失敗しました');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('記録保存エラー:', error);
      setMessage('記録の保存に失敗しました');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const autoSelectTournamentByGeolocation = async () => {
    if (!navigator.geolocation) {
      setGeoStatus('? この端末は位置情報に対応していません');
      return;
    }
    setGeoStatus('?? 位置情報を取得中...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const candidates = (state.registeredTournaments || [])
            .map(t => {
              const tLat = Number(t?.data?.venueLat);
              const tLng = Number(t?.data?.venueLng);
              if (!Number.isFinite(tLat) || !Number.isFinite(tLng)) return null;
              return { t, dist: distanceKm(lat, lng, tLat, tLng) };
            })
            .filter(Boolean)
            .sort((a, b) => a.dist - b.dist);

          if (candidates.length === 0) {
            setGeoStatus('?? 会場の緯度/経度が登録されている大会がありません');
            return;
          }

          const nearest = candidates[0];
          setSelectedTournamentId(nearest.t.id);
          setGeoStatus(`? 近い大会を自動選択しました（約${nearest.dist.toFixed(1)}km）`);
        } catch (e) {
          console.error(e);
          setGeoStatus('? 位置情報から大会の自動選択に失敗しました');
        }
      },
      (err) => {
        const msg = err?.message ? `? 位置情報の取得に失敗しました: ${err.message}` : '? 位置情報の取得に失敗しました';
        setGeoStatus(msg);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  };

  const handleQRCodeScanned = async (qrData) => {
    try {
      const data = JSON.parse(qrData);
      setScannedQR(data.id);
      setShowQRScanner(false);
      setTimeout(() => {
        const archerId = data.id;
        if (archerId) {
          handleCheckIn(archerId);
        }
      }, 100);
    } catch (error) {
      setMessage('? QRコードの読み込みに失敗しました');
    }
  };

  const handleCheckIn = async (scannedArcherId = null) => {
    if (!selectedTournamentId) {
      setMessage('? 大会を選択してください');
      return;
    }

    const archerId = scannedArcherId || scannedQR.trim();
    if (!archerId) {
      setMessage('? 選手IDを入力するか、QRコードをスキャンしてください');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/applicants/checkin/${selectedTournamentId}/${archerId}`, {
        method: 'POST'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || '受付に失敗しました');
      }

      const applicant = result.data.find(a => a.archerId === archerId);
      if (!applicant) {
        setMessage('? 該当する選手が見つかりません');
        return;
      }

      if (!applicant.isCheckedIn) {
        const checkInResult = await fetch(`${API_URL}/applicants/${selectedTournamentId}/${archerId}/checkin`, {
          method: 'PATCH'
        }).then(r => r.json());
      
        if (checkInResult.success) {
          const successMessage = checkInResult.data.isCheckedIn 
            ? `? ${checkInResult.data.name}さんは既に受付済みです`
            : `? ${checkInResult.data.name}さんの受付が完了しました`;
          
          setMessage(successMessage);
          setScannedQR('');
          setTimeout(() => {
            setMessage('');
            setShowQRModal(false);
          }, 3000);
        } else {
          setMessage(`? ${checkInResult.message || '受付に失敗しました'}`);
        }
      } else {
        setMessage(`? ${applicant.name}さんは既に受付済みです`);
        setScannedQR('');
        setTimeout(() => {
          setMessage('');
          setShowQRModal(false);
        }, 3000);
      }
    } catch (error) {
      setMessage(`? エラーが発生しました: ${error.message}`);
    } finally {
      setTimeout(() => setMessage(''), 5000);
    }
  };

  if (adminView === 'recording') {
    return (
      <div className="view-container">
        <div className="admin-header">
          <h1>記録管理</h1>
          <button onClick={onLogout} className="btn-secondary">
            <LogOut size={16} className="mr-1" />
            ログアウト
          </button>
        </div>

        <div className="view-content">
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="card-title">部門選択</h2>
              <div className="flex gap-2">
                <button onClick={() => fetchAndSortArchers(true)} className="btn-secondary" disabled={isLoading}>
                  <RefreshCw size={16} className={`mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                  同期
                </button>
                {isSyncing && (
                  <span className="text-sm text-gray-500 self-center">
                    同期中
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {divisions.map(division => (
                <button
                  key={division.id}
                  onClick={() => setSelectedDivision(division.id)}
                  className={`btn ${selectedDivision === division.id ? 'btn-active' : ''}`}
                  style={{ flex: '1 1 calc(33.333% - 0.5rem)', minWidth: '150px' }}
                >
                  {division.label}
                </button>
              ))}
            </div>
            {enableGenderSeparation && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button onClick={() => setSelectedGender('all')} className={`btn ${selectedGender === 'all' ? 'btn-active' : ''}`} style={{ flex: 1 }}>全員</button>
                <button onClick={() => setSelectedGender('male')} className={`btn ${selectedGender === 'male' ? 'btn-active' : ''}`} style={{ flex: 1 }}>男子</button>
                <button onClick={() => setSelectedGender('female')} className={`btn ${selectedGender === 'female' ? 'btn-active' : ''}`} style={{ flex: 1 }}>女子</button>
              </div>
            )}
            <p className="hint" style={{ marginTop: '0.5rem' }}>この部門の選手数: {divisionArchers.length}人</p>
          </div>

          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="card-title">立ち順・ラウンド選択</h2>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label className="label">立ち</label>
                <select value={selectedStand} onChange={(e) => setSelectedStand(parseInt(e.target.value))} className="input">
                  {Array.from({ length: stands }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}立ち</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="label">ラウンド</label>
                <select value={selectedRound} onChange={(e) => setSelectedRound(parseInt(e.target.value))} className="input">
                  <option value={1}>1立ち目</option>
                  <option value={2}>2立ち目</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="card-title">記録入力</h2>
              <p className="text-sm text-gray-600">
                {getCurrentArrowsPerStand()}本 / 選手
              </p>
            </div>

            {message && (
              <div className={`message ${message.startsWith('?') ? 'message-success' : 'message-warning'}`} style={{ marginBottom: '1rem' }}>
                {message}
              </div>
            )}

            <div className="recording-grid">
              {getArchersForStand(selectedStand).map(archer => (
                <div key={archer.archerId} className="archer-card">
                  <div className="archer-header">
                    <span className="archer-order">{archer.standOrder}</span>
                    <span className="archer-name">{archer.name}</span>
                    <span className="archer-affiliation">{archer.affiliation}</span>
                  </div>
                  <div className="arrows-container">
                    {Array.from({ length: getCurrentArrowsPerStand() }, (_, i) => {
                      const arrowIndex = selectedRound === 1 ? i : tournament.arrowsRound1 + i;
                      const result = archer.results?.[`stand${selectedStand}`]?.[arrowIndex];
                      const isEditing = editingArrow?.archerId === archer.archerId && 
                                       editingArrow?.standNumber === selectedStand && 
                                       editingArrow?.arrowIndex === arrowIndex;

                      return (
                        <button
                          key={i}
                          onClick={() => handleArrowClick(archer.archerId, selectedStand, arrowIndex)}
                          className={`arrow-btn ${result === 'o' ? 'hit' : result === 'x' ? 'miss' : ''} ${isEditing ? 'editing' : ''}`}
                        >
                          {result === 'o' ? '○' : result === 'x' ? '×' : i + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {editingArrow && (
              <div className="editing-modal">
                <div className="editing-modal-content">
                  <h3>結果入力</h3>
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <button
                      onClick={() => handleArrowResult(editingArrow.archerId, editingArrow.standNumber, editingArrow.arrowIndex, 'o')}
                      className="btn-success"
                    >
                      ○ 的中
                    </button>
                    <button
                      onClick={() => handleArrowResult(editingArrow.archerId, editingArrow.standNumber, editingArrow.arrowIndex, 'x')}
                      className="btn-danger"
                    >
                      × 外れ
                    </button>
                    <button
                      onClick={() => setEditingArrow(null)}
                      className="btn-secondary"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (adminView === 'checkin') {
    return (
      <div className="view-container">
        <div className="admin-header">
          <h1>受付管理</h1>
          <button onClick={onLogout} className="btn-secondary">
            <LogOut size={16} className="mr-1" />
            ログアウト
          </button>
        </div>

        <div className="view-content">
          <div className="card">
            <div className="tournament-info">
              <p>? {selectedTournament?.data?.name || '大会名不明'}</p>
              <p>? {selectedTournament?.data?.datetime || '日時未設定'}</p>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <input 
                type="text" 
                value={locationFilter} 
                onChange={(e) => setLocationFilter(e.target.value)} 
                placeholder="開催地でフィルター" 
                className="input w-full mb-2"
              />
              <button onClick={autoSelectTournamentByGeolocation} className="btn-secondary" style={{ width: '100%', marginBottom: '0.5rem' }}>
                ?? 現在地から大会を自動選択
              </button>
              {geoStatus && (
                <p className="text-sm text-gray-600" style={{ marginBottom: '0.5rem' }}>{geoStatus}</p>
              )}
              <select value={selectedTournamentId} onChange={(e) => setSelectedTournamentId(e.target.value)} className="input w-full">
                <option value="">-- 大会を選択してください --</option>
                {filteredTournaments.map(t => (
                  <option key={t.id} value={t.id}>{t.data.name} ({t.data.location})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setShowQRScanner(true)} className="btn-primary" style={{ flex: 1 }}>
                <QrCode size={24} style={{ marginRight: '0.5rem' }} />
                QRコードで受付
              </button>
              <button 
                onClick={() => setShowQRModal(true)}
                style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline', marginTop: '0.5rem' }}
              >
                ?? ID手動入力・スキャン(係員用)
              </button>
            </div>

            {message && (
              <div className={`message ${message.startsWith('?') ? 'message-success' : 'message-warning'}`} style={{ marginTop: '1rem' }}>
                {message}
              </div>
            )}

            {showQRScanner && (
              <QRCodeScanner
                onScanSuccess={handleQRCodeScanned}
                onError={(msg) => setMessage('? ' + msg)}
                onClose={() => setShowQRScanner(false)}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  if (adminView === 'awards') {
    return (
      <div className="view-container">
        <div className="admin-header">
          <h1>表彰管理</h1>
          <button onClick={onLogout} className="btn-secondary">
            <LogOut size={16} className="mr-1" />
            ログアウト
          </button>
        </div>

        <div className="view-content">
          <AwardsView 
            state={state} 
            dispatch={dispatch} 
            selectedTournamentId={selectedTournamentId} 
            setSelectedTournamentId={setSelectedTournamentId} 
          />
        </div>
      </div>
    );
  }

  return null;
};

export default AdminView;
