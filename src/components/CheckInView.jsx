import React, { useState, useEffect, useReducer, useCallback } from 'react';
import { Lock, LogOut, RotateCcw, Copy, Check, QrCode, Maximize2, Filter, X, User, Camera } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import QRCodeScanner from './QRCodeScanner';
import { applicantsApi, API_URL } from '../utils/api';
import { judgeNearFarCompetition, calculateRanksWithTies } from '../utils/competition';
import { autoSelectTournamentByGeolocationAndDate } from '../utils/tournamentSelection';

const CheckInView = ({ state, dispatch }) => {
  const [scannedQR, setScannedQR] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [checkIns, setCheckIns] = useState([]);
  const [notCheckedIns, setNotCheckedIns] = useState([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState(() => localStorage.getItem('selectedTournamentId') || '');
  const [showQRModal, setShowQRModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [geoStatus, setGeoStatus] = useState('');
  const [currentQRCodeData, setCurrentQRCodeData] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [myApplicantData, setMyApplicantData] = useState(null);
  const [showManualInput, setShowManualInput] = useState(true);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successName, setSuccessName] = useState('');
  const checkinListRef = React.useRef(null);
  const isProcessingRef = React.useRef(false);

  useEffect(() => {
    if (selectedTournamentId) {
      localStorage.setItem('selectedTournamentId', selectedTournamentId);
    } else {
      localStorage.removeItem('selectedTournamentId');
    }
  }, [selectedTournamentId]);


  
  const filteredTournaments = state.registeredTournaments.filter(tournament => {
    if (locationFilter === '') return true;
    const q = locationFilter.toLowerCase();
    const loc = (tournament.data.location || '').toLowerCase();
    const addr = (tournament.data.venueAddress || '').toLowerCase();
    return loc.includes(q) || addr.includes(q);
  });

  const autoSelectTournamentByGeolocation = () => {
    autoSelectTournamentByGeolocationAndDate(
      state.registeredTournaments,
      (message, tournamentId) => {
        setGeoStatus(message);
        if (tournamentId) {
          setSelectedTournamentId(tournamentId);
        }
      },
      (errorMessage) => {
        setGeoStatus(errorMessage);
      }
    );
  };


  useEffect(() => {
    const savedUser = localStorage.getItem('kyudo_tournament_user');
    const savedDeviceId = localStorage.getItem('kyudo_tournament_device_id');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const fetchTournamentData = async (silent = false) => {
    if (!selectedTournamentId) return;
    
    if (!silent) setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const result = await response.json();
      
      if (result.success) {
        const sortByTeam = (a, b) => {
          if (a.affiliation !== b.affiliation) return a.affiliation.localeCompare(b.affiliation);
          const aTeam = a.teamName || '';
          const bTeam = b.teamName || '';
          if (aTeam !== bTeam) return aTeam.localeCompare(bTeam);
          return new Date(a.appliedAt) - new Date(b.appliedAt);
        };
        const checkedIn = result.data.filter(a => a.isCheckedIn).sort(sortByTeam);
        const notCheckedIn = result.data.filter(a => !a.isCheckedIn).sort(sortByTeam);
        setCheckIns(checkedIn);
        setNotCheckedIns(notCheckedIn);
        
        const savedDeviceId = localStorage.getItem('kyudo_tournament_device_id');
        
        if (savedDeviceId) {
          const myRegistrations = result.data.filter(a => 
            a.deviceId === savedDeviceId
          );
          
          if (myRegistrations.length > 0) {
            setMyApplicantData(myRegistrations.length === 1 ? myRegistrations[0] : myRegistrations);
            if (!silent) setShowManualInput(false);
          } else {
            setMyApplicantData(null);
            if (!silent) setShowManualInput(true);
          }
        } else {
          setMyApplicantData(null);
          if (!silent) setShowManualInput(true);
        }
      }
    } catch (error) {
      console.error('データの取得に失敗しました:', error);
      if (!silent) setMessage('? データの取得に失敗しました');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!autoRefresh || !selectedTournamentId || showQRScanner || showQRModal) return;
    const interval = setInterval(() => {
      fetchTournamentData(true);
    }, 2000); 
    return () => clearInterval(interval);
  }, [autoRefresh, selectedTournamentId, showQRScanner, showQRModal]);

  useEffect(() => {
    if (selectedTournamentId) {
      setAutoRefresh(false); 
      fetchTournamentData();
    } else {
      setCheckIns([]);
      setMyApplicantData(null);
      setAutoRefresh(false);
    }
  }, [selectedTournamentId]);

  const showQRCodeFromMultiple = (applicant) => {
    setShowQRModal(true);
    setAutoRefresh(true); 
    const tournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
    setCurrentQRCodeData({
      id: applicant.archerId,
      name: applicant.name,
      type: applicant.isStaff && applicant.isOfficialOnly ? '役員' : '選手',
      tournamentName: tournament?.data?.name || '不明な大会',
      affiliation: applicant.affiliation,
      rank: applicant.rank,
      gender: applicant.gender,
      teamName: applicant.teamName,
      registrationDate: applicant.appliedAt
    });
  };

  const showMyQRCode = () => {
    if (!myApplicantData) return;
    if (Array.isArray(myApplicantData)) {
      return;
    }
    setAutoRefresh(true);
    const tournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
    setCurrentQRCodeData({
      id: myApplicantData.archerId,
      name: myApplicantData.name,
      type: myApplicantData.isStaff && myApplicantData.isOfficialOnly ? '役員' : '選手',
      tournamentName: tournament?.data?.name || '不明な大会',
      affiliation: myApplicantData.affiliation,
      rank: myApplicantData.rank,
      gender: myApplicantData.gender,
      teamName: myApplicantData.teamName,
      registrationDate: myApplicantData.appliedAt
    });
    setShowQRModal(true);
  };

  const showListQRCode = (archer) => {
    setAutoRefresh(true);
    const tournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
    setCurrentQRCodeData({
      id: archer.archerId,
      name: archer.name,
      type: archer.isStaff && archer.isOfficialOnly ? '役員' : '選手',
      tournamentName: tournament?.data?.name || '',
      affiliation: archer.affiliation,
      rank: archer.rank,
      gender: archer.gender,
      teamName: archer.teamName,
      registrationDate: archer.appliedAt,
      isCheckedIn: archer.isCheckedIn
    });
    setShowQRModal(true);
  };

  const showScreenshotQRCode = (archer) => {
    setAutoRefresh(true);
    const tournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
    setCurrentQRCodeData({
      id: archer.archerId,
      name: archer.name,
      type: archer.isStaff && archer.isOfficialOnly ? '役員' : '選手',
      tournamentName: tournament?.data?.name || '',
      affiliation: archer.affiliation,
      rank: archer.rank,
      registrationDate: archer.appliedAt,
      isCheckedIn: true,
      isScreenshot: true
    });
    setShowQRModal(true);
  };

  const handleQRCodeScanned = async (qrCode) => {
    if (isProcessingRef.current) {
      console.log('Already processing, ignoring scan');
      return;
    }
    isProcessingRef.current = true;
    
    try {
      let archerId = qrCode.trim();
      try {
        const qrData = JSON.parse(qrCode);
        if (qrData.id) {
          archerId = qrData.id;
        }
      } catch (parseError) {}
      
      setShowQRScanner(false);
      await handleCheckIn(archerId);
    } catch (error) {
      setMessage('? QRコードの読み込みに失敗しました');
      setShowQRScanner(false);
    } finally {
      isProcessingRef.current = false;
    }
  };

  const openQRScanner = () => {
    if (!selectedTournamentId) {
      setMessage('? 大会を選択してください');
      return;
    }
    isProcessingRef.current = false;
    setShowQRScanner(true);
  };

  const handleCheckIn = async (scannedArcherId = null) => {
    if (!selectedTournamentId) {
      setMessage('? 大会を選択してください');
      return;
    }

    const archerId = (scannedArcherId || scannedQR).trim();
    if (!archerId) {
      setMessage('? 選手IDを入力するか、QRコードをスキャンしてください');
      return;
    }

    setMessage('処理中...');

    try {
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error('選手情報の取得に失敗しました');
      }

      const applicant = result.data.find(a => a.archerId === archerId);
      if (!applicant) {
        setMessage('? 該当する選手が見つかりません');
        return;
      }

      const checkInResponse = await fetch(`${API_URL}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: selectedTournamentId, archerId: archerId })
      });

      const checkInResult = await checkInResponse.json();
      
      if (checkInResult.success) {
        const isAlreadyCheckedIn = checkInResult.data.isCheckedIn;
        const successMessage = isAlreadyCheckedIn
          ? `✅ ${checkInResult.data.name}さんは既に受付済みです`
          : `✅ ${checkInResult.data.name}さんの受付が完了しました`;
        
        if (!isAlreadyCheckedIn) {
          setSuccessName(checkInResult.data.name);
          setShowSuccessPopup(true);
          setTimeout(() => setShowSuccessPopup(false), 3000);
        }
        
        setMessage(successMessage);
        setScannedQR('');
        setAutoRefresh(true);
        await fetchTournamentData(true);
      } else {
        setMessage(`? ${checkInResult.message || '受付に失敗しました'}`);
      }
    } catch (error) {
      setMessage(`? エラーが発生しました: ${error.message}`);
    } finally {
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const selectedTournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
  
  const isTournamentDay = () => {
    if (!selectedTournament?.data?.datetime) return false;
    try {
      const tournamentDate = new Date(selectedTournament.data.datetime);
      const today = new Date();
      return tournamentDate.toDateString() === today.toDateString();
    } catch {
      return false;
    }
  };
  
  const formatTournamentDate = (tournament) => {
    if (!tournament?.data) return '日時未設定';
    const { datetime } = tournament.data;
    if (!datetime) return '日時未設定';
    try {
      const date = new Date(datetime);
      if (isNaN(date.getTime())) return datetime;
      const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
      const weekday = weekdays[date.getDay()];
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}年${month}月${day}日(${weekday}) ${hours}:${minutes}`;
    } catch (error) {
      return datetime;
    }
  };
  
  return (
    <div className="view-container">
      <div className="sport-header">
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.2)', borderRadius: '0.75rem', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '1.75rem' }}>📋</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>受付</h1>
          </div>
        {selectedTournament ? (
          <div style={{ background: 'rgba(255, 255, 255, 0.15)', borderRadius: '0.75rem', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🏹</span>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{selectedTournament.data?.name || '大会名不明'}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '1rem' }}>📅</span>
              <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.95 }}>{formatTournamentDate(selectedTournament)}</p>
            </div>
            {myApplicantData && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1rem' }}>👤</span>
                <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.95 }}>{Array.isArray(myApplicantData) ? '複数登録あり' : 
                  `${myApplicantData.isStaff ? '役員' : '選手'}ID: ${myApplicantData.archerId}`}</p>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: 'rgba(251, 191, 36, 0.2)', borderRadius: '0.75rem', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>大会を選択してください</p>
          </div>
        )}
        </div>
      </div>
      <div className="view-content">
        <div className="card">
          <label>大会を選択 *</label>
          <div className="mb-2">
            <input 
              type="text" 
              value={locationFilter} 
              onChange={(e) => setLocationFilter(e.target.value)} 
              placeholder="開催地/住所でフィルター" 
              className="input w-full mb-2"
            />
            <button onClick={autoSelectTournamentByGeolocation} className="btn-secondary" style={{ width: '100%', marginBottom: '0.5rem' }}>
              📍 現在地＋日付から大会を自動選択
            </button>
            {geoStatus && (
              <p className="text-sm text-gray-600" style={{ marginBottom: '0.5rem' }}>{geoStatus}</p>
            )}
            <select 
              value={selectedTournamentId} 
              onChange={(e) => setSelectedTournamentId(e.target.value)}
              className="input w-full"
            >
              <option value="">-- 大会を選択してください --</option>
              {filteredTournaments.length === 0 ? (
                <option disabled>該当する大会が見つかりません</option>
              ) : (
                filteredTournaments.map(tournament => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.data.name} ({tournament.data.location}{tournament.data.venueAddress ? ` / ${tournament.data.venueAddress}` : ''})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {selectedTournamentId && (
          <>
            <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', borderRadius: '1rem', padding: '2rem', textAlign: 'center', boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.3)' }}>
              <p style={{ fontSize: '3rem', fontWeight: 700, margin: 0 }}>{checkIns.length}</p>
              <p style={{ fontSize: '1rem', marginTop: '0.5rem', opacity: 0.95 }}>受付済み</p>
            </div>

            <div className="card">
              {myApplicantData ? (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  {Array.isArray(myApplicantData) ? (
                    <>
                      <p className="text-sm text-gray-500" style={{ marginBottom: '1rem' }}>複数の登録が見つかりました</p>
                      <div className="archer-list" style={{ marginBottom: '1rem', maxHeight: '200px', overflowY: 'auto' }}>
                        {myApplicantData.map((applicant) => (
                          <div key={applicant.archerId} className="archer-list-item" style={{ marginBottom: '0.5rem', padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <p style={{ fontWeight: '500', margin: 0 }}>{applicant.name} 様</p>
                                <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: '0.25rem 0 0 0' }}>
                                  {applicant.affiliation} | {applicant.rank}
                                </p>
                              </div>
                              <button 
                                onClick={() => showQRCodeFromMultiple(applicant)}
                                className="btn-secondary"
                                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                              >
                                <QrCode size={16} style={{ marginRight: '0.25rem' }} />
                                表示
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500" style={{ marginBottom: '0.5rem' }}>ログイン中: {myApplicantData.name} 様</p>
                      <button 
                        onClick={showMyQRCode}
                        className="btn-primary"
                        style={{ 
                          marginTop: 0,
                          width: '100%',
                          padding: '1.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.125rem'
                        }}
                      >
                        <QrCode size={24} style={{ marginRight: '0.5rem' }} />
                        ?? 自分のQRコードを表示
                      </button>
                    </>
                  )}
                  
                  {!showManualInput ? (
                    <button 
                      onClick={() => setShowManualInput(true)}
                      style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline', marginTop: '0.5rem' }}
                    >
                      ?? ID手動入力・スキャン(係員用)
                    </button>
                  ) : (
                    <button 
                      onClick={() => setShowManualInput(false)}
                      style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.875rem', marginTop: '0.5rem' }}
                    >
                      ▲ 入力欄を隠す
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ marginBottom: '0.5rem' }}>
                  <p className="text-sm text-gray-500" style={{ marginBottom: '0.5rem' }}>
                    {currentUser ? '※この大会へのエントリーが見つかりません' : '※選手としてログインしていません'}
                  </p>
                </div>
              )}

              {(showManualInput || !myApplicantData) && (
                <div style={{ marginTop: myApplicantData ? '1rem' : '0', paddingTop: myApplicantData ? '1rem' : '0', borderTop: myApplicantData ? '1px solid #e5e7eb' : 'none' }}>
                  <label>選手IDを入力 (係員用)</label>
                  <input 
                    type="text" 
                    value={scannedQR} 
                    onChange={(e) => setScannedQR(e.target.value)} 
                    onKeyPress={(e) => e.key === 'Enter' && handleCheckIn()} 
                    placeholder="選手IDを入力してEnter" 
                    className="input" 
                    disabled={isLoading}
                  />
                  <div className="space-y-2" style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="flex space-x-2" style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        onClick={() => handleCheckIn()} 
                        className="btn-secondary"
                        style={{ flex: 1 }}
                        disabled={isLoading || !scannedQR.trim()}
                      >
                        {isLoading ? '処理中...' : 'IDで受付実行'}
                      </button>
                    </div>
                    
                    <button
                      onClick={openQRScanner}
                      className="btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
                    >
                      <Camera size={18} style={{ marginRight: '0.5rem' }} />
                      QRコードをスキャン
                    </button>
                  </div>
                </div>
              )}

              {message && (
                <div className={`message ${message.startsWith('?') ? 'message-success' : message.startsWith('?') ? 'message-error' : 'message-warning'}`} style={{ marginTop: '1rem' }}>
                  {message}
                </div>
              )}

              {showQRScanner && (
                <QRCodeScanner
                  key={Date.now()}
                  onScanSuccess={handleQRCodeScanned}
                  onError={(msg) => setMessage('? ' + msg)}
                  onClose={() => {
                    setShowQRScanner(false);
                    isProcessingRef.current = false;
                  }}
                />
              )}
            </div>

            <div className="sport-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '2px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                  <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#1f2937' }}>未受付一覧</h3>
                </div>
              </div>
              <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                  <thead style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', borderBottom: '2px solid #fbbf24' }}>
                    <tr>
                      <th style={{ padding: '0.875rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>ID</th>
                      <th style={{ padding: '0.875rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>氏名</th>
                      <th style={{ padding: '0.875rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>所属</th>
                      <th style={{ padding: '0.875rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>チーム名</th>
                      <th style={{ padding: '0.875rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>段位</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notCheckedIns.length > 0 ? (
                      notCheckedIns.map(archer => (
                        <tr key={archer.archerId} style={{ borderBottom: '1px solid #fef3c7' }}>
                          <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8125rem', color: '#92400e', whiteSpace: 'nowrap' }}>{archer.archerId}</td>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: '#78350f', whiteSpace: 'nowrap' }}>{archer.name}</td>
                          <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8125rem', color: '#92400e' }}>{archer.affiliation}</td>
                          <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8125rem', color: '#92400e', whiteSpace: 'nowrap' }}>{archer.teamName || '-'}</td>
                          <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8125rem', color: '#92400e', whiteSpace: 'nowrap' }}>{archer.rank}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '2rem', opacity: 0.3 }}>✅</span>
                            <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.9375rem' }}>全員受付済みです</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="sport-card" ref={checkinListRef}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '2px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>📋</span>
                  <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#1f2937' }}>受付済み一覧</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {autoRefresh && (
                    <div style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ display: 'inline-block', width: '0.5rem', height: '0.5rem', backgroundColor: '#10b981', borderRadius: '50%', animation: 'pulse 1.5s ease-in-out infinite' }}></span>
                      自動更新中
                    </div>
                  )}
                  <button 
                    onClick={fetchTournamentData} 
                    style={{ fontSize: '0.875rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
                    disabled={isLoading}
                  >
                    {isLoading ? '更新中...' : '更新'}
                  </button>
                </div>
              </div>
              <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                  <thead style={{ background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)', borderBottom: '2px solid #e5e7eb' }}>
                    <tr>
                      <th style={{ padding: '0.875rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>ID</th>
                      <th style={{ padding: '0.875rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>氏名</th>
                      <th style={{ padding: '0.875rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>所属</th>
                      <th style={{ padding: '0.875rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>チーム名</th>
                      <th style={{ padding: '0.875rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>段位</th>
                      <th style={{ padding: '0.875rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkIns.length > 0 ? (
                      checkIns.map(archer => (
                        <tr key={archer.archerId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{archer.archerId}</td>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: '#1f2937', whiteSpace: 'nowrap' }}>{archer.name}</td>
                          <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}>{archer.affiliation}</td>
                          <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{archer.teamName || '-'}</td>
                          <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{archer.rank}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <button 
                              onClick={() => showListQRCode(archer)}
                              style={{ 
                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.5rem',
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap'
                              }}
                              onMouseEnter={(e) => e.target.style.transform = 'translateY(-1px)'}
                              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                            >
                              <QrCode size={14} /> QR
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '2rem', opacity: 0.3 }}>📋</span>
                            <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.9375rem' }}>受付データがありません</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {showQRModal && currentQRCodeData && (
              <div className="qr-modal-overlay" onClick={(e) => {
                if (e.target.className === 'qr-modal-overlay') {
                  setShowQRModal(false);
                  setAutoRefresh(false);
                  fetchTournamentData(true);
                }
              }}>
                <div className="qr-modal-container">
                  <div className="qr-modal-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h2>✅ {currentQRCodeData.type}登録完了</h2>
                        <p className="qr-tournament-name">🏹 {currentQRCodeData.tournamentName}</p>
                      </div>
                      <button
                        onClick={() => {
                          setShowQRModal(false);
                          setAutoRefresh(false);
                          fetchTournamentData(true);
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.2)',
                          border: 'none',
                          color: 'white',
                          fontSize: '1.5rem',
                          width: '2.5rem',
                          height: '2.5rem',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                        onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  
                  <div className="qr-modal-body">
                    <div className="qr-code-wrapper">
                      <QRCodeSVG 
                        value={JSON.stringify({
                          id: currentQRCodeData.id,
                          name: currentQRCodeData.name,
                          type: currentQRCodeData.type,
                          tournament: currentQRCodeData.tournamentName,
                          affiliation: currentQRCodeData.affiliation,
                          rank: currentQRCodeData.rank,
                          timestamp: currentQRCodeData.registrationDate
                        })}
                        size={280}
                        level="H"
                        includeMargin={true}
                      />
                      <div style={{ marginTop: '1rem', fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', wordBreak: 'break-all' }}>
                        🆔 {currentQRCodeData.id}
                      </div>
                    </div>
                    
                    <div className="qr-info-box">
                      <p className="qr-name">👤 {currentQRCodeData.name} 様</p>
                      <p className="qr-details">🏛️ {currentQRCodeData.affiliation}</p>
                      {currentQRCodeData.teamName && <p className="qr-details">👥 {currentQRCodeData.teamName}</p>}
                      <p className="qr-details">🎯 {currentQRCodeData.rank}</p>
                      
                      <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f0f9ff', border: '2px solid #bfdbfe', borderRadius: '0.75rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#1e40af' }}>
                          ⚧ 性別情報の設定・更新
                        </label>
                        <select 
                          value={currentQRCodeData.gender || 'male'} 
                          onChange={async (e) => {
                            const newGender = e.target.value;
                            try {
                              const response = await fetch(`${API_URL}/applicants/${currentQRCodeData.id}/gender`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ gender: newGender })
                              });
                              
                              if (response.ok) {
                                setCurrentQRCodeData(prev => ({ ...prev, gender: newGender }));
                                alert('✅ 性別情報を更新しました');
                                await fetchTournamentData(true);
                              } else {
                                alert('❌ 更新に失敗しました');
                              }
                            } catch (error) {
                              console.error('性別情報更新エラー:', error);
                              alert('❌ 更新中にエラーが発生しました');
                            }
                          }}
                          className="input"
                          style={{ width: '100%', marginBottom: '0.5rem', backgroundColor: 'white' }}
                        >
                          <option value="male">👨 男</option>
                          <option value="female">👩 女</option>
                        </select>
                        <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0 }}>
                          現在の設定: {currentQRCodeData.gender === 'female' ? '👩 女' : '👨 男'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      {showSuccessPopup && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white',
          padding: '2rem 3rem',
          borderRadius: '1rem',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          zIndex: 10000,
          textAlign: 'center',
          minWidth: '300px',
          animation: 'fadeIn 0.3s ease-in-out'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            {successName}さん
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
            受付完了しました
          </div>
        </div>
      )}
      
      {showSuccessPopup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9999
        }} onClick={() => setShowSuccessPopup(false)} />
      )}
    </div>
  );
};


export default CheckInView;