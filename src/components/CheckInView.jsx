import React, { useState, useEffect } from 'react';
import { QrCode, User, ChevronLeft } from 'lucide-react';
import QRCodeScanner from './QRCodeScanner';
import { API_URL } from '../utils/api';
import { getLocalDateKey } from '../utils/tournament';

const CheckInView = ({ state, dispatch }) => {
  const [selectedTournamentId, setSelectedTournamentId] = useState(() => localStorage.getItem('selectedTournamentId') || '');
  const [isStaff, setIsStaff] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [message, setMessage] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannedQR, setScannedQR] = useState('');
  const [currentQRCodeData, setCurrentQRCodeData] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [geoStatus, setGeoStatus] = useState('');
  const [myApplicantData, setMyApplicantData] = useState(null);

  useEffect(() => {
    if (selectedTournamentId) {
      localStorage.setItem('selectedTournamentId', selectedTournamentId);
    } else {
      localStorage.removeItem('selectedTournamentId');
    }
  }, [selectedTournamentId]);

  useEffect(() => {
    const fetchMyApplicantData = async () => {
      if (!selectedTournamentId) {
        setMyApplicantData(null);
        return;
      }

      try {
        const deviceId = localStorage.getItem('kyudo_tournament_device_id') || `device_${Math.random().toString(36).substr(2, 9)}`;
        const response = await fetch(`${API_URL}/applicants/by-device/${selectedTournamentId}/${deviceId}`);
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setMyApplicantData(result.data);
          }
        }
      } catch (error) {
        console.error('自分の申し込みデータ取得エラー:', error);
      }
    };

    fetchMyApplicantData();
  }, [selectedTournamentId]);

  const filteredTournaments = state.registeredTournaments.filter(tournament => 
    locationFilter === '' || 
    (tournament.data.location && tournament.data.location.toLowerCase().includes(locationFilter.toLowerCase()))
  );

  const selectedTournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);

  const formatTournamentDate = (tournament) => {
    if (!tournament?.data?.datetime) return '日時未設定';
    try {
      const date = new Date(tournament.data.datetime);
      return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return tournament.data.datetime;
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

  const showQRCode = (id, name, type, tournamentName = '', affiliation = '', rank = '', gender = 'male') => {
    setCurrentQRCodeData({ 
      id, 
      name, 
      type,
      tournamentName,
      affiliation,
      rank,
      gender,
      registrationDate: new Date().toISOString()
    });
    setShowQRModal(true);
  };

  const handleCloseQRModal = () => {
    setShowQRModal(false);
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
          <div className="mb-2">
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
              {filteredTournaments.length === 0 ? (
                <option disabled>該当する大会が見つかりません</option>
              ) : (
                filteredTournaments.map(t => (
                  <option key={t.id} value={t.id}>{t.data.name} ({t.data.location})</option>
                ))
              )}
            </select>
          </div>
          
          {selectedTournamentId && (
            <>
              {myApplicantData && (
                <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '0.5rem' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>自分の情報</h3>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                    <strong>{myApplicantData.isStaff ? '役員' : '選手'}:</strong> {myApplicantData.name}
                  </p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                    <strong>所属:</strong> {myApplicantData.affiliation}
                  </p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                    <strong>段位:</strong> {myApplicantData.rank}
                  </p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
                    <strong>状態:</strong> {myApplicantData.isCheckedIn ? '✅ 受付済み' : '⏳ 未受付'}
                  </p>
                  {!myApplicantData.isCheckedIn && (
                    <button 
                      onClick={() => handleCheckIn(myApplicantData.archerId)}
                      className="btn-primary"
                      style={{ marginTop: '0.5rem', width: '100%' }}
                    >
                      自分を受付する
                    </button>
                  )}
                  {myApplicantData.isCheckedIn && (
                    <button 
                      onClick={() => showQRCode(
                        myApplicantData.archerId,
                        myApplicantData.name,
                        myApplicantData.isStaff ? '役員' : '選手',
                        selectedTournament?.data?.name || '',
                        myApplicantData.affiliation,
                        myApplicantData.rank,
                        myApplicantData.gender
                      )}
                      className="btn-secondary"
                      style={{ marginTop: '0.5rem', width: '100%' }}
                    >
                      <QrCode size={24} style={{ marginRight: '0.5rem' }} />
                      ?? 自分のQRコードを表示
                    </button>
                  )}
                </div>
              )}

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
            </>
          )}

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

      {showQRModal && (
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
              </div>
            </div>
            
            <div className="qr-info-box">
              <p className="qr-name">{currentQRCodeData.name} 様</p>
              <p className="qr-details">{currentQRCodeData.affiliation}</p>
              <p className="qr-details">{currentQRCodeData.rank}</p>
              
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
            <div className="qr-modal-footer">
              <button
                onClick={handleCloseQRModal}
                className="btn-primary"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckInView;
