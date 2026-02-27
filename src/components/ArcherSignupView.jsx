import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { API_URL } from '../utils/api';
import { getDivisionForArcher } from '../utils/tournament';

const ArcherSignupView = ({ state, dispatch }) => {
  const [selectedTournamentId, setSelectedTournamentId] = useState(() => localStorage.getItem('selectedTournamentId') || '');
  const [isStaff, setIsStaff] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [formData, setFormData] = useState({
    name: '', 
    affiliation: '', 
    rank: '初段', 
    rankAcquiredDate: '',
    gender: 'male',
    isOfficialOnly: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  
  const [qrCodeData, setQrCodeData] = useState({ 
    id: '', 
    name: '', 
    type: '',
    tournamentName: '',
    affiliation: '',
    rank: '',
    registrationDate: ''
  });

  useEffect(() => {
    if (selectedTournamentId) {
      localStorage.setItem('selectedTournamentId', selectedTournamentId);
    } else {
      localStorage.removeItem('selectedTournamentId');
    }
  }, [selectedTournamentId]);

  const filteredTournaments = state.registeredTournaments.filter(tournament => 
    locationFilter === '' || 
    (tournament.data.location && tournament.data.location.toLowerCase().includes(locationFilter.toLowerCase()))
  );
  
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

  const getDivisionFromRank = (rank, tournamentDivisions) => {
    const { ceremony } = (() => {
      const ceremonyRanks = ['錬士', '教士', '範士'];
      let ceremony = '';
      let r = rank || '';
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

    const normalized = normalizeRank(rank);
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
        if (idx !== -1 && idx >= effectiveMin && idx <= effectiveMax) return d.id;
      }
    }

    const idx3 = rankOrder.indexOf('参段');
    const idx5 = rankOrder.indexOf('五段');

    if (idx !== -1 && idx <= idx3) return 'lower';
    if (idx !== -1 && idx <= idx5) return 'middle';

    return 'lower';
  };

  const handleInputChange = (field, value) => { 
    setFormData(prev => ({ ...prev, [field]: value })); 
  };

  const showQRCode = (id, name, type, tournamentName = '', affiliation = '', rank = '', gender = 'male') => {
    setQrCodeData({ 
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

  const handleApply = async () => {
    if (!selectedTournamentId || !formData.name || !formData.affiliation || (formData.rank !== '無指定' && !formData.rankAcquiredDate)) {
      alert('すべての必須項目を入力してください');
      return;
    }

    try {
      const tournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
      if (!tournament) {
        alert('大会が見つかりません');
        return;
      }

      const archerId = `${selectedTournamentId}_${Date.now().toString(36).toUpperCase()}`;
      const deviceId = localStorage.getItem('kyudo_tournament_device_id') || `device_${Math.random().toString(36).substr(2, 9)}`;
      
      const divisionForApplicant = getDivisionForArcher({
        rank: formData.rank,
        gender: formData.gender
      }, tournament?.data?.divisions);

      const applicantData = {
        name: formData.name,
        affiliation: formData.affiliation,
        rank: formData.rank,
        rankAcquiredDate: formData.rankAcquiredDate,
        gender: formData.gender,
        isStaff: isStaff,
        isOfficialOnly: formData.isOfficialOnly,
        archerId: archerId,
        division: divisionForApplicant,
        appliedAt: new Date().toISOString(),
        deviceId: deviceId
      };

      const response = await fetch(`${API_URL}/applicants`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tournamentId: selectedTournamentId,
          archerId: archerId,
          applicantData: applicantData
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showQRCode(
          archerId,
          formData.name,
          isStaff ? '役員' : '選手',
          tournament?.data?.name || '不明な大会',
          formData.affiliation,
          formData.rank,
          formData.gender
        );

        localStorage.setItem('kyudo_tournament_device_id', deviceId);
        localStorage.setItem('kyudo_tournament_user', JSON.stringify(applicantData));
        try {
          const stored = localStorage.getItem('kyudo_tournament_users');
          const list = stored ? JSON.parse(stored) : [];
          const safeList = Array.isArray(list) ? list : [];
          safeList.push(applicantData);
          localStorage.setItem('kyudo_tournament_users', JSON.stringify(safeList));
        } catch {
          // ignore
        }
        
        setFormData({
          name: '',
          affiliation: '',
          rank: '初段',
          rankAcquiredDate: '',
          gender: 'male',
          isOfficialOnly: false
        });
        setIsStaff(false);
      } else {
        throw new Error(result.message || '申し込みに失敗しました');
      }
    } catch (error) {
      console.error('申し込みエラー:', error);
      alert(`申し込み処理中にエラーが発生しました: ${error.message}`);
    }
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <h1>選手申し込み</h1>
      </div>
      <div className="view-content">
        <div className="card">
          <label>大会を選択 *</label>
          <div className="mb-2">
            <input 
              type="text" 
              value={locationFilter} 
              onChange={(e) => setLocationFilter(e.target.value)} 
              placeholder="開催地でフィルター" 
              className="input w-full mb-2"
            />
            <select 
              value={selectedTournamentId} 
              onChange={(e) => setSelectedTournamentId(e.target.value)} 
              className="input w-full"
            >
              <option value="">-- 大会を選択してください --</option>
              {filteredTournaments.length === 0 ? (
                <option disabled>該当する大会が見つかりません</option>
              ) : (
                filteredTournaments.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.data.name} ({t.data.location})
                  </option>
                ))
              )}
            </select>
          </div>
          
        </div>

        {selectedTournamentId && (
          <div className="card">
            <input type="text" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="氏名 *" className="input" />
            <input type="text" value={formData.affiliation} onChange={(e) => handleInputChange('affiliation', e.target.value)} placeholder="所属 *" className="input" />
            <select value={formData.rank} onChange={(e) => handleInputChange('rank', e.target.value)} className="input">
              {rankOrder.map(rank => (<option key={rank} value={rank}>{rank}</option>))}
            </select>
            <div>
              <label>性別 *</label>
              <select value={formData.gender} onChange={(e) => handleInputChange('gender', e.target.value)} className="input">
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </div>
            {formData.rank !== '無指定' && (
              <div>
                <label>段位取得日 *</label>
                <input 
                  type="date" 
                  value={formData.rankAcquiredDate} 
                  onChange={(e) => handleInputChange('rankAcquiredDate', e.target.value)} 
                  className="input w-full" 
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}
            <button onClick={handleApply} className="btn-primary">申し込む</button>
          </div>
        )}

        {showQRModal && (
          <div className="qr-modal-overlay" onClick={(e) => {
            if (e.target.className === 'qr-modal-overlay') {
              handleCloseQRModal();
            }
          }}>
            <div className="qr-modal-container">
              <div className="qr-modal-header">
                <h2>✅ {qrCodeData.type}登録完了</h2>
                <p className="qr-tournament-name">🏹 {qrCodeData.tournamentName}</p>
              </div>
              
              <div className="qr-modal-body">
                <div className="qr-code-wrapper">
                  <QRCodeSVG 
                    value={JSON.stringify({
                      id: qrCodeData.id,
                      name: qrCodeData.name,
                      type: qrCodeData.type,
                      tournament: qrCodeData.tournamentName,
                      affiliation: qrCodeData.affiliation,
                      rank: qrCodeData.rank,
                      timestamp: qrCodeData.registrationDate
                    })}
                    size={280}
                    level="H"
                    includeMargin={true}
                  />
                  <div style={{ marginTop: '1rem', fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', wordBreak: 'break-all' }}>
                    🆔 {qrCodeData.id}
                  </div>
                </div>
                
                <div className="qr-info-box">
                  <p className="qr-name">👤 {qrCodeData.name} 様</p>
                  <p className="qr-details">🏛️ {qrCodeData.affiliation}</p>
                  <p className="qr-details">🎯 {qrCodeData.rank}</p>
                  
                  <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f0f9ff', border: '2px solid #bfdbfe', borderRadius: '0.75rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#1e40af' }}>
                      ⚧ 性別情報の設定・更新
                    </label>
                    <select 
                      value={qrCodeData.gender || 'male'} 
                      onChange={async (e) => {
                        const newGender = e.target.value;
                        try {
                          const response = await fetch(`${API_URL}/applicants/${qrCodeData.id}/gender`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ gender: newGender })
                          });
                          
                          if (response.ok) {
                            setQrCodeData(prev => ({ ...prev, gender: newGender }));
                            alert('✅ 性別情報を更新しました');
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
                      現在の設定: {qrCodeData.gender === 'female' ? '👩 女' : '👨 男'}
                    </p>
                  </div>
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
    </div>
  );
};

export default ArcherSignupView;