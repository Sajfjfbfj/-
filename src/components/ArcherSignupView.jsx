import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { API_URL } from '../utils/api';
import { getDivisionForArcher } from '../utils/tournament';
import { autoSelectTournamentByGeolocationAndDate } from '../utils/tournamentSelection';

const ArcherSignupView = ({ state, dispatch }) => {
  const [selectedTournamentId, setSelectedTournamentId] = useState(() => localStorage.getItem('selectedTournamentId') || '');
  const [isStaff, setIsStaff] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [geoStatus, setGeoStatus] = useState('');
  const [myApplications, setMyApplications] = useState([]);
  const [formData, setFormData] = useState({
    name: '', 
    affiliation: '', 
    rank: '初段', 
    rankAcquiredDate: '',
    gender: 'male',
    isOfficialOnly: false
  });
  const [teams, setTeams] = useState([{
    id: Date.now(),
    teamName: '',
    affiliation: '',
    members: [
      { name: '', rank: '初段', gender: 'male' },
      { name: '', rank: '初段', gender: 'male' },
      { name: '', rank: '初段', gender: 'male' }
    ]
  }]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeQueue, setQrCodeQueue] = useState([]);
  const [currentQRIndex, setCurrentQRIndex] = useState(0);
  
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
      fetchMyApplications();
    } else {
      localStorage.removeItem('selectedTournamentId');
      setMyApplications([]);
    }
  }, [selectedTournamentId]);

  const fetchMyApplications = async () => {
    if (!selectedTournamentId) return;
    const deviceId = localStorage.getItem('kyudo_tournament_device_id');
    if (!deviceId) return;

    try {
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const result = await response.json();
      if (result.success) {
        const myApps = result.data.filter(a => a.deviceId === deviceId);
        setMyApplications(myApps);
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    }
  };

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

  const handleTeamInputChange = (teamId, field, value) => {
    setTeams(prev => prev.map(team => 
      team.id === teamId ? { ...team, [field]: value } : team
    ));
  };

  const handleTeamMemberChange = (teamId, memberIndex, field, value) => {
    setTeams(prev => prev.map(team => {
      if (team.id === teamId) {
        const newMembers = [...team.members];
        newMembers[memberIndex] = { ...newMembers[memberIndex], [field]: value };
        return { ...team, members: newMembers };
      }
      return team;
    }));
  };

  const handleAddTeamMember = (teamId) => {
    setTeams(prev => prev.map(team => 
      team.id === teamId 
        ? { ...team, members: [...team.members, { name: '', rank: '初段', gender: 'male' }] }
        : team
    ));
  };

  const handleRemoveTeamMember = (teamId, memberIndex) => {
    setTeams(prev => prev.map(team => {
      if (team.id === teamId && team.members.length > 1) {
        return { ...team, members: team.members.filter((_, i) => i !== memberIndex) };
      }
      return team;
    }));
  };

  const handleAddTeam = () => {
    setTeams(prev => [...prev, {
      id: Date.now(),
      teamName: '',
      affiliation: '',
      members: [
        { name: '', rank: '初段', gender: 'male' },
        { name: '', rank: '初段', gender: 'male' },
        { name: '', rank: '初段', gender: 'male' }
      ]
    }]);
  };

  const handleRemoveTeam = (teamId) => {
    if (teams.length <= 1) {
      alert('チームは最低1つ必要です');
      return;
    }
    setTeams(prev => prev.filter(team => team.id !== teamId));
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
    setQrCodeQueue([]);
    setCurrentQRIndex(0);
    setShowQRModal(true);
  };

  const showMultipleQRCodes = (qrDataArray) => {
    setQrCodeQueue(qrDataArray);
    setCurrentQRIndex(0);
    if (qrDataArray.length > 0) {
      setQrCodeData(qrDataArray[0]);
      setShowQRModal(true);
    }
  };

  const handleNextQR = () => {
    if (currentQRIndex < qrCodeQueue.length - 1) {
      const nextIndex = currentQRIndex + 1;
      setCurrentQRIndex(nextIndex);
      setQrCodeData(qrCodeQueue[nextIndex]);
    }
  };

  const handlePrevQR = () => {
    if (currentQRIndex > 0) {
      const prevIndex = currentQRIndex - 1;
      setCurrentQRIndex(prevIndex);
      setQrCodeData(qrCodeQueue[prevIndex]);
    }
  };

  const handleCloseQRModal = () => {
    setShowQRModal(false);
    setQrCodeQueue([]);
    setCurrentQRIndex(0);
    fetchMyApplications();
  };

  const handleShareQR = async () => {
    try {
      const qrText = `名前: ${qrCodeData.name}
所属: ${qrCodeData.affiliation}
段位: ${qrCodeData.rank}
大会: ${qrCodeData.tournamentName}
ID: ${qrCodeData.id}`;
      
      if (navigator.share) {
        await navigator.share({
          title: `${qrCodeData.name}様のQRコード`,
          text: qrText
        });
      } else {
        await navigator.clipboard.writeText(qrText);
        alert('✅ 情報をクリップボードにコピーしました');
      }
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleApply = async () => {
    if (isSubmitting) return;
    
    const tournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
    if (!tournament) {
      alert('大会が見つかりません');
      return;
    }
    
    setIsSubmitting(true);

    const isTeamCompetition = tournament.data.competitionType === 'team';

    if (isTeamCompetition) {
      for (const team of teams) {
        if (!team.teamName || !team.affiliation || team.members.some(m => !m.name)) {
          alert('すべてのチームの必須項目を入力してください');
          return;
        }
      }
    } else {
      if (!formData.name || !formData.affiliation || (formData.rank !== '無指定' && !formData.rankAcquiredDate)) {
        alert('すべての必須項目を入力してください');
        return;
      }
    }

    try {
      const deviceId = localStorage.getItem('kyudo_tournament_device_id') || `device_${Math.random().toString(36).substr(2, 9)}`;
      
      if (isTeamCompetition) {
        const allQRData = [];
        
        for (const team of teams) {
          for (let memberIndex = 0; memberIndex < team.members.length; memberIndex++) {
            const member = team.members[memberIndex];
            await new Promise(resolve => setTimeout(resolve, 10));
            const timestamp = Date.now();
            const archerId = `${selectedTournamentId}_${timestamp.toString(36).toUpperCase()}`;
            const applicantData = {
              name: member.name,
              affiliation: team.affiliation,
              rank: member.rank,
              gender: member.gender,
              teamName: team.teamName,
              isTeamMember: true,
              archerId: archerId,
              appliedAt: new Date(timestamp + memberIndex).toISOString(),
              deviceId: deviceId
            };

            const response = await fetch(`${API_URL}/applicants`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tournamentId: selectedTournamentId,
                archerId: archerId,
                applicantData: applicantData
              })
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
              throw new Error(result.message || `${member.name}の申し込みに失敗しました`);
            }

            allQRData.push({
              id: archerId,
              name: member.name,
              type: `${team.teamName}のメンバー`,
              tournamentName: tournament?.data?.name || '不明な大会',
              affiliation: team.affiliation,
              rank: member.rank,
              gender: member.gender,
              registrationDate: new Date().toISOString()
            });
          }
        }

        localStorage.setItem('kyudo_tournament_device_id', deviceId);
        await fetchMyApplications();
        showMultipleQRCodes(allQRData);

        setTeams([{
          id: Date.now(),
          teamName: '',
          affiliation: '',
          members: [
            { name: '', rank: '初段', gender: 'male' },
            { name: '', rank: '初段', gender: 'male' },
            { name: '', rank: '初段', gender: 'male' }
          ]
        }]);
        localStorage.setItem('kyudo_tournament_device_id', deviceId);
      } else {
        const archerId = `${selectedTournamentId}_${Date.now().toString(36).toUpperCase()}`;
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
          headers: { 'Content-Type': 'application/json' },
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
          setFormData({
            name: '',
            affiliation: '',
            rank: '初段',
            rankAcquiredDate: '',
            gender: 'male',
            isOfficialOnly: false
          });
          setIsStaff(false);
          localStorage.setItem('kyudo_tournament_device_id', deviceId);
          localStorage.setItem('kyudo_tournament_user', JSON.stringify(applicantData));
          try {
            const stored = localStorage.getItem('kyudo_tournament_users');
            const list = stored ? JSON.parse(stored) : [];
            const safeList = Array.isArray(list) ? list : [];
            safeList.push(applicantData);
            localStorage.setItem('kyudo_tournament_users', JSON.stringify(safeList));
          } catch {}
          await fetchMyApplications();
        } else {
          throw new Error(result.message || '申し込みに失敗しました');
        }
      }
    } catch (error) {
      console.error('申し込みエラー:', error);
      alert(`申し込み処理中にエラーが発生しました: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="view-container">
      <div className="sport-header">
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.2)', borderRadius: '0.75rem', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '1.75rem' }}>🎯</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>選手申し込み</h1>
          </div>
        </div>
      </div>
      <div className="view-content">
        <div className="sport-card">
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.125rem', fontWeight: 700, color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🏹</span>大会選択
            </h3>
            <input 
              type="text" 
              value={locationFilter} 
              onChange={(e) => setLocationFilter(e.target.value)} 
              placeholder="開催地でフィルター" 
              style={{ width: '100%', padding: '0.875rem 1rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '1rem', marginBottom: '0.75rem' }}
            />
            <button 
              onClick={() => autoSelectTournamentByGeolocationAndDate(
                state.registeredTournaments,
                (message, tournamentId) => {
                  setGeoStatus(message);
                  if (tournamentId) setSelectedTournamentId(tournamentId);
                },
                (errorMessage) => setGeoStatus(errorMessage)
              )}
              style={{ 
                width: '100%', 
                padding: '0.875rem 1rem', 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: '0.75rem'
              }}
            >
              📍 現在地＋日付から大会を自動選択
            </button>
            {geoStatus && (
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>{geoStatus}</p>
            )}
            <select 
              value={selectedTournamentId} 
              onChange={(e) => setSelectedTournamentId(e.target.value)} 
              style={{ width: '100%', padding: '0.875rem 1rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '1rem' }}
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

        {selectedTournamentId && (() => {
          const tournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
          const isTeamCompetition = tournament?.data?.competitionType === 'team';

          if (isTeamCompetition) {
            return (
              <>
                {teams.map((team, teamIndex) => (
                  <div key={team.id} className="sport-card" style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>📝</span>チーム {teamIndex + 1}
                      </h3>
                      {teams.length > 1 && (
                        <button 
                          onClick={() => handleRemoveTeam(team.id)}
                          style={{ padding: '0.5rem 1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          チーム削除
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <input 
                        type="text" 
                        value={team.teamName} 
                        onChange={(e) => handleTeamInputChange(team.id, 'teamName', e.target.value)} 
                        placeholder="チーム名 *" 
                        style={{ padding: '0.875rem 1rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '1rem' }} 
                      />
                      <input 
                        type="text" 
                        value={team.affiliation} 
                        onChange={(e) => handleTeamInputChange(team.id, 'affiliation', e.target.value)} 
                        placeholder="所属（○○支部とお書きください） *" 
                        style={{ padding: '0.875rem 1rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '1rem' }} 
                      />
                      
                      <div style={{ marginTop: '0.5rem' }}>
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>メンバー情報</h4>
                        {team.members.map((member, memberIndex) => (
                          <div key={memberIndex} style={{ marginBottom: '1rem', padding: '1rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', background: '#f9fafb' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ fontWeight: 600, color: '#6b7280' }}>メンバー {memberIndex + 1}</span>
                              {team.members.length > 1 && (
                                <button 
                                  onClick={() => handleRemoveTeamMember(team.id, memberIndex)}
                                  style={{ padding: '0.25rem 0.75rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem', cursor: 'pointer' }}
                                >
                                  削除
                                </button>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <input 
                                type="text" 
                                value={member.name} 
                                onChange={(e) => handleTeamMemberChange(team.id, memberIndex, 'name', e.target.value)} 
                                placeholder="氏名 *" 
                                style={{ flex: 1, padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.95rem' }} 
                              />
                              <select 
                                value={member.rank} 
                                onChange={(e) => handleTeamMemberChange(team.id, memberIndex, 'rank', e.target.value)} 
                                style={{ flex: 1, padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.95rem' }}
                              >
                                {rankOrder.map(rank => (<option key={rank} value={rank}>{rank}</option>))}
                              </select>
                            </div>
                            <select 
                              value={member.gender} 
                              onChange={(e) => handleTeamMemberChange(team.id, memberIndex, 'gender', e.target.value)} 
                              style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.95rem' }}
                            >
                              <option value="male">👨 男</option>
                              <option value="female">👩 女</option>
                            </select>
                          </div>
                        ))}
                        <button 
                          onClick={() => handleAddTeamMember(team.id)}
                          style={{ width: '100%', padding: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          + メンバー追加
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <button 
                  onClick={handleAddTeam}
                  style={{ width: '100%', padding: '1rem', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', border: 'none', borderRadius: '0.75rem', fontSize: '1.125rem', fontWeight: 700, cursor: 'pointer', marginBottom: '1rem' }}
                >
                  + チーム追加
                </button>
                <button 
                  onClick={handleApply} 
                  className="btn-primary" 
                  style={{ width: '100%', padding: '1rem', fontSize: '1.125rem', fontWeight: 700 }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '申し込み中...' : 'すべてのチームを申し込む'}
                </button>
              </>
            );
          } else {
            return (
              <div className="sport-card">
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: 700, color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📝</span>申し込み情報
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <input type="text" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="氏名 *" style={{ padding: '0.875rem 1rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '1rem' }} />
                  <input type="text" value={formData.affiliation} onChange={(e) => handleInputChange('affiliation', e.target.value)} placeholder="所属（○○支部とお書きください） *" style={{ padding: '0.875rem 1rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '1rem' }} />
                  <select value={formData.rank} onChange={(e) => handleInputChange('rank', e.target.value)} style={{ padding: '0.875rem 1rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '1rem' }}>
                    {rankOrder.map(rank => (<option key={rank} value={rank}>{rank}</option>))}
                  </select>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#6b7280' }}>性別 *</label>
                    <select value={formData.gender} onChange={(e) => handleInputChange('gender', e.target.value)} style={{ width: '100%', padding: '0.875rem 1rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '1rem' }}>
                      <option value="male">👨 男</option>
                      <option value="female">👩 女</option>
                    </select>
                  </div>
                  {formData.rank !== '無指定' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#6b7280' }}>段位取得日 *</label>
                      <input 
                        type="date" 
                        value={formData.rankAcquiredDate} 
                        onChange={(e) => handleInputChange('rankAcquiredDate', e.target.value)} 
                        style={{ width: '100%', padding: '0.875rem 1rem', border: '2px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '1rem' }}
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  )}
                  <button 
                    onClick={handleApply} 
                    className="btn-primary" 
                    style={{ marginTop: '0.5rem', width: '100%', padding: '1rem', fontSize: '1.125rem', fontWeight: 700 }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? '申し込み中...' : '申し込む'}
                  </button>
                </div>
              </div>
            );
          }
        })()}

        {showQRModal && (
          <div className="qr-modal-overlay" onClick={(e) => {
            if (e.target.className === 'qr-modal-overlay') {
              handleCloseQRModal();
            }
          }}>
            <div className="qr-modal-container">
              <div className="qr-modal-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2>✅ {qrCodeData.type}登録完了</h2>
                    <p className="qr-tournament-name">🏹 {qrCodeData.tournamentName}</p>
                    {qrCodeQueue.length > 0 && (
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: 'rgba(255,255,255,0.9)' }}>
                        {currentQRIndex + 1} / {qrCodeQueue.length}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleCloseQRModal}
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
                {qrCodeQueue.length > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
                    <button
                      onClick={handlePrevQR}
                      disabled={currentQRIndex === 0}
                      style={{
                        padding: '0.5rem 1.5rem',
                        background: currentQRIndex === 0 ? '#9ca3af' : 'rgba(255, 255, 255, 0.2)',
                        border: 'none',
                        color: 'white',
                        borderRadius: '0.5rem',
                        cursor: currentQRIndex === 0 ? 'not-allowed' : 'pointer',
                        fontSize: '1rem',
                        fontWeight: 600
                      }}
                    >
                      ← 前へ
                    </button>
                    <button
                      onClick={handleNextQR}
                      disabled={currentQRIndex === qrCodeQueue.length - 1}
                      style={{
                        padding: '0.5rem 1.5rem',
                        background: currentQRIndex === qrCodeQueue.length - 1 ? '#9ca3af' : 'rgba(255, 255, 255, 0.2)',
                        border: 'none',
                        color: 'white',
                        borderRadius: '0.5rem',
                        cursor: currentQRIndex === qrCodeQueue.length - 1 ? 'not-allowed' : 'pointer',
                        fontSize: '1rem',
                        fontWeight: 600
                      }}
                    >
                      次へ →
                    </button>
                  </div>
                )}
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
                  
                  <button
                    onClick={handleShareQR}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      marginTop: '1rem',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    📤 他端末と共有
                  </button>
                  
                  <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f0fdf4', border: '2px solid #86efac', borderRadius: '0.75rem' }}>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      📸 スクリーンショットで共有も可能
                    </p>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#15803d', lineHeight: '1.4' }}>
                      この画面をスクリーンショットして他の端末に送れば、その画像からも受付できます
                    </p>
                  </div>
                  
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
            </div>
          </div>
        )}

        {myApplications.length > 0 && (
          <div className="sport-card">
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: 700, color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📋</span>この端末からの申し込み一覧
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {myApplications.map(app => (
                <div key={app.archerId} style={{ padding: '1rem', border: '2px solid #e5e7eb', borderRadius: '0.75rem', background: '#f9fafb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '1rem', color: '#1f2937' }}>
                        {app.name} 様
                        {app.teamName && <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>(👥 {app.teamName})</span>}
                      </p>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                        {app.affiliation} | {app.rank}
                      </p>
                    </div>
                    <button 
                      onClick={() => showQRCode(
                        app.archerId,
                        app.name,
                        app.isTeamMember ? `${app.teamName}のメンバー` : (app.isStaff ? '役員' : '選手'),
                        state.registeredTournaments.find(t => t.id === selectedTournamentId)?.data?.name || '',
                        app.affiliation,
                        app.rank,
                        app.gender
                      )}
                      style={{ 
                        padding: '0.75rem 1.5rem',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.transform = 'translateY(-1px)'}
                      onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                    >
                      QRコード表示
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArcherSignupView;