import React, { useState, useEffect, useReducer, useCallback } from 'react';
import { Lock, LogOut, RotateCcw, Copy, Check, QrCode, Maximize2, Filter, X, User, Camera } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import QRCodeScanner from './QRCodeScanner';
import { applicantsApi, API_URL } from '../utils/api';
import { judgeNearFarCompetition, calculateRanksWithTies } from '../utils/competition';

const CheckInView = ({ state, dispatch }) => {
  const [scannedQR, setScannedQR] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [checkIns, setCheckIns] = useState([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState(() => localStorage.getItem('selectedTournamentId') || '');
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    if (selectedTournamentId) {
      localStorage.setItem('selectedTournamentId', selectedTournamentId);
    } else {
      localStorage.removeItem('selectedTournamentId');
    }
  }, [selectedTournamentId]);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [geoStatus, setGeoStatus] = useState('');
  const [currentQRCodeData, setCurrentQRCodeData] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const checkinListRef = React.useRef(null);
  
  const filteredTournaments = state.registeredTournaments.filter(tournament => {
    if (locationFilter === '') return true;
    const q = locationFilter.toLowerCase();
    const loc = (tournament.data.location || '').toLowerCase();
    const addr = (tournament.data.venueAddress || '').toLowerCase();
    return loc.includes(q) || addr.includes(q);
  });

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
  
  const [currentUser, setCurrentUser] = useState(null);
  const [myApplicantData, setMyApplicantData] = useState(null);
  const [showManualInput, setShowManualInput] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('kyudo_tournament_user');
    const savedDeviceId = localStorage.getItem('kyudo_tournament_device_id');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const fetchTournamentData = async () => {
    if (!selectedTournamentId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const result = await response.json();
      
      if (result.success) {
        const checkedIn = result.data.filter(a => a.isCheckedIn);
        setCheckIns(checkedIn);
        
        const savedDeviceId = localStorage.getItem('kyudo_tournament_device_id');
        
        if (savedDeviceId) {
          const myRegistrations = result.data.filter(a => 
            a.deviceId === savedDeviceId
          );
          
          if (myRegistrations.length > 0) {
            setMyApplicantData(myRegistrations[0]);
            setShowManualInput(false);
            if (myRegistrations.length > 1) {
              setMyApplicantData(myRegistrations);
            }
          } else {
            setMyApplicantData(null);
            setShowManualInput(true);
          }
        } else {
          setMyApplicantData(null);
          setShowManualInput(true);
        }
      }
    } catch (error) {
      console.error('データの取得に失敗しました:', error);
      setMessage('? データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!autoRefresh || !selectedTournamentId) return;
    const interval = setInterval(() => {
      fetchTournamentData();
    }, 2000); 
    return () => clearInterval(interval);
  }, [autoRefresh, selectedTournamentId]);

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

  const handleQRCodeScanned = (qrCode) => {
    try {
      let archerId = qrCode.trim();
      try {
        const qrData = JSON.parse(qrCode);
        if (qrData.id) {
          archerId = qrData.id;
        }
      } catch (parseError) {}
      
      setScannedQR(archerId);
      setShowQRScanner(false);
      
      setTimeout(() => {
        handleCheckIn(archerId);
      }, 100);
    } catch (error) {
      setMessage('? QRコードの読み込みに失敗しました');
    }
  };

  const openQRScanner = () => {
    if (!selectedTournamentId) {
      setMessage('? 大会を選択してください');
      return;
    }
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

    setIsLoading(true);
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
        const successMessage = checkInResult.data.isCheckedIn 
          ? `? ${checkInResult.data.name}さんは既に受付済みです`
          : `? ${checkInResult.data.name}さんの受付が完了しました`;
        
        setMessage(successMessage);
        setScannedQR('');
        setAutoRefresh(true);
        await fetchTournamentData();
        
        setTimeout(() => {
          if (checkinListRef.current) {
            checkinListRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 300);
      } else {
        setMessage(`? ${checkInResult.message || '受付に失敗しました'}`);
      }
    } catch (error) {
      setMessage(`? エラーが発生しました: ${error.message}`);
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const selectedTournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
  
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
      <div className="view-header">
        <h1>受付</h1>
        {selectedTournament ? (
          <div className="tournament-info">
            <p>? {selectedTournament.data?.name || '大会名不明'}</p>
            <p>? {formatTournamentDate(selectedTournament)}</p>
            {myApplicantData && (
              <p>? {Array.isArray(myApplicantData) ? '複数登録あり' : 
                `${myApplicantData.isStaff ? '役員' : '選手'}ID: ${myApplicantData.archerId}`}</p>
            )}
          </div>
        ) : (
          <div className="tournament-info">
            <p>? 大会を選択してください</p>
          </div>
        )}
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
              ?? 現在地から大会を自動選択
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
            <div className="checkin-counter">
              <p className="counter-value">{checkIns.length}</p>
              <p className="counter-label">受付済み</p>
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
                  onScanSuccess={handleQRCodeScanned}
                  onError={(msg) => setMessage('? ' + msg)}
                  onClose={() => setShowQRScanner(false)}
                />
              )}
            </div>

            <div className="card" ref={checkinListRef}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <p className="card-title">受付済み一覧</p>
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
              <div className="table-responsive">
                <table className="archer-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>氏名</th>
                      <th>所属</th>
                      <th>段位</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkIns.length > 0 ? (
                      checkIns.map(archer => (
                        <tr key={archer.archerId} className={archer.isCheckedIn ? 'checked-in' : ''}>
                          <td>
                            {archer.archerId}
                            {archer.isCheckedIn && (
                              <span className="check-in-badge">受付済</span>
                            )}
                          </td>
                          <td>{archer.name}</td>
                          <td>{archer.affiliation}</td>
                          <td>{archer.rank}</td>
                          <td className="action-buttons">
                            <button 
                              onClick={() => showListQRCode(archer)}
                              className="btn-secondary"
                            >
                              <QrCode size={16} /> QR
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="text-center py-4">
                          <p className="text-gray-500">受付データがありません</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {showQRModal && currentQRCodeData && (
                <div className="qr-modal-overlay">
                  <div className="qr-modal-container">
                    <div className="qr-modal-header">
                      <h2>{currentQRCodeData.type}登録完了</h2>
                      <p className="qr-tournament-name">{currentQRCodeData.tournamentName}</p>
                    </div>
                    
                    <div className="qr-modal-body">
                      <div className="qr-code-wrapper" style={{ textAlign: 'center' }}>
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
                        <div style={{ marginTop: '1rem', fontWeight: 'bold', wordBreak: 'break-all' }}>
                          ID: {currentQRCodeData.id}
                        </div>
                      </div>
                      
                      <div className="qr-info-box">
                        <p className="qr-name">{currentQRCodeData.name} 様</p>
                        <p className="qr-details">{currentQRCodeData.affiliation}</p>
                        <p className="qr-details">{currentQRCodeData.rank}</p>
                        
                        {/* 性別選択・更新機能 */}
                        <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '0.5rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                            性別情報の設定・更新
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
                                  alert('性別情報を更新しました');
                                } else {
                                  alert('更新に失敗しました');
                                }
                              } catch (error) {
                                console.error('性別情報更新エラー:', error);
                                alert('更新中にエラーが発生しました');
                              }
                            }}
                            className="input"
                            style={{ width: '100%', marginBottom: '0.5rem' }}
                          >
                            <option value="male">男</option>
                            <option value="female">女</option>
                          </select>
                          <p className="text-sm text-gray-600">
                            現在の設定: {currentQRCodeData.gender === 'female' ? '女' : '男'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="qr-modal-footer">
                      <button
                        onClick={() => {
                          setShowQRModal(false);
                          setAutoRefresh(false);
                        }}
                        className="btn-primary"
                      >
                        閉じる
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};


export default CheckInView;