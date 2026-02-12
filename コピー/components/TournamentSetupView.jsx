import React, { useState, useEffect } from 'react';
import { tournamentsApi, API_URL } from '../utils/api';
import { 
  normalizeTournamentFormData, 
  getStoredAttachments, 
  setStoredAttachments 
} from '../utils/tournament';

const TournamentSetupView = ({ state, dispatch }) => {
  const [copied, setCopied] = useState(false);
  const [tournamentId, setTournamentId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [geocodeStatus, setGeocodeStatus] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [formData, setFormData] = useState({
    name: '', datetime: '', location: '', venueAddress: '', venueLat: '', venueLng: '', organizer: '', coOrganizer: '', administrator: '', purpose: '', event: '', type: '', category: '', description: '', competitionMethod: '', award: '', qualifications: '', applicableRules: '', applicationMethod: '', remarks: '',
    attachments: [],
    divisions: [
      { id: 'lower', label: '級位~三段以下の部' },
      { id: 'middle', label: '四・五段の部' },
      { id: 'title', label: '称号者の部' }
    ]
  });

  const filteredTournaments = state.registeredTournaments.filter(tournament => 
    locationFilter === '' || 
    (tournament.data.location && tournament.data.location.toLowerCase().includes(locationFilter.toLowerCase()))
  );

  const generateTournamentId = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `KYUDO_${dateStr}_${random}`;
  };

  const handleInputChange = (field, value) => { setFormData(prev => ({ ...prev, [field]: value })); };
  const defaultDivisions = [
    { id: 'lower', label: '級位~三段以下の部', minRank: '五級', maxRank: '参段' },
    { id: 'middle', label: '四・五段の部', minRank: '四段', maxRank: '五段' },
    { id: 'title', label: '称号者の部', minRank: '錬士五段', maxRank: '範士九段' }
  ];

  const handleGeocodeAddress = async () => {
    const addrRaw = (formData.venueAddress || '').trim();
    if (!addrRaw) {
      setGeocodeStatus('? 会場住所を入力してください');
      return;
    }
    const postalMatch = addrRaw.match(/\b\d{3}-?\d{4}\b/);
    const postal = postalMatch ? postalMatch[0].replace('-', '') : '';
    const normalizeQuery = (s) => {
      if (!s) return '';
      const toHalfWidth = (str) => {
        // Numbers and some symbols to half-width
        return String(str)
          .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
          .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
          .replace(/[，、]/g, ',')
          .replace(/[．。]/g, '.')
          .replace(/[：]/g, ':')
          .replace(/[（]/g, '(')
          .replace(/[）]/g, ')')
          .replace(/[－ー―‐?????]/g, '-')
          .replace(/[　]/g, ' ');
      };

      return toHalfWidth(s)
        .replace(/\(.*?\)/g, ' ')
        .replace(/（.*?）/g, ' ')
        .replace(/〒\s*\d{3}-?\d{4}/g, ' ')
        .replace(/〒/g, ' ')
        .replace(/\bJapan\b/gi, ' ')
        .replace(/\b日本\b/g, ' ')
        .replace(/TEL[:：]?\s*\d{2,4}-\d{2,4}-\d{3,4}/gi, ' ')
        .replace(/\d{2,4}-\d{2,4}-\d{3,4}/g, ' ')
        // try to normalize Japanese block numbers
        .replace(/(\d+)丁目/g, '$1-')
        .replace(/(\d+)番地?/g, '$1-')
        .replace(/(\d+)号/g, '$1')
        .replace(/[\s,]+/g, ' ')
        .trim();
    };
    const addr = normalizeQuery(addrRaw);

    const tryQueries = [];
    if (addr) tryQueries.push(addr);

    // If postal code exists, also try with it (Nominatim sometimes matches better)
    if (postal) {
      const formattedPostal = postal.length === 7 ? `${postal.slice(0, 3)}-${postal.slice(3)}` : postal;
      const withPostal = normalizeQuery(`${formattedPostal} ${addr}`);
      if (withPostal && !tryQueries.includes(withPostal)) tryQueries.push(withPostal);
    }

    // Remove common building keywords (keep the rest)
    const noBuilding = normalizeQuery(addr.replace(/(武道館|体育館|道場|弓道場|会館|ホール|センター|公民館|市民会館|県立|市立)/g, ''));
    if (noBuilding && noBuilding !== addr) tryQueries.push(noBuilding);
    // Remove trailing block names after comma-like spaces
    const noLastToken = normalizeQuery(addr.split(' ').slice(0, -1).join(' '));
    if (noLastToken && noLastToken !== addr && noLastToken !== noBuilding) tryQueries.push(noLastToken);

    // Remove number-heavy tail (often helps with Japanese addresses)
    const coarse = normalizeQuery(addr.replace(/\d[\d-]*/g, ' '));
    if (coarse && coarse !== addr && coarse !== noBuilding && !tryQueries.includes(coarse)) tryQueries.push(coarse);

    setIsGeocoding(true);
    setGeocodeStatus('?? 住所から座標を取得中...');
    try {
      let found = null;
      for (const q of tryQueries) {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=jp&addressdetails=1&q=${encodeURIComponent(q)}`;
        const resp = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Accept-Language': 'ja'
          }
        });
        if (!resp.ok) {
          continue;
        }
        const data = await resp.json();
        const first = Array.isArray(data) ? data.find(x => x?.lat && x?.lon) : null;
        if (first) {
          found = first;
          break;
        }
      }

      if (!found) {
        // Fallback: GSI (Geospatial Information Authority of Japan) address search
        // https://msearch.gsi.go.jp/address-search/AddressSearch?q=...
        let gsiFound = null;
        for (const q of tryQueries) {
          const gsiUrl = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`;
          const resp = await fetch(gsiUrl, { headers: { 'Accept': 'application/json' } });
          if (!resp.ok) continue;
          const data = await resp.json();
          const first = Array.isArray(data) ? data.find(x => Array.isArray(x?.geometry?.coordinates) && x.geometry.coordinates.length >= 2) : null;
          if (first) {
            gsiFound = first;
            break;
          }
        }

        if (!gsiFound) {
          setGeocodeStatus('?? 住所から座標を取得できませんでした（住所を短くする/市区町村までにする/時間をおく などを試してください）');
          return;
        }

        const [lng, lat] = gsiFound.geometry.coordinates;
        setFormData(prev => ({ ...prev, venueLat: String(lat), venueLng: String(lng) }));
        setGeocodeStatus('? 座標を取得しました（国土地理院）');
        return;
      }

      setFormData(prev => ({ ...prev, venueLat: String(found.lat), venueLng: String(found.lon) }));
      setGeocodeStatus('? 座標を取得しました（Nominatim）');
    } catch (e) {
      console.error('Nominatim geocode error:', e);
      setGeocodeStatus('? 座標取得に失敗しました（時間をおいて再試行してください）');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleLoadTemplateSafe = (template) => {
    const data = template.data || {};
    const storedAttachments = getStoredAttachments(template.id);
    setFormData(normalizeTournamentFormData(data, defaultDivisions, storedAttachments));
    setTournamentId(template.id);
    setIsEditing(true);
  };

  const handleAttachmentsChange = async (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    try {
      const readAsDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: typeof reader.result === 'string' ? reader.result : ''
        });
        reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
        reader.readAsDataURL(file);
      });

      const newAttachments = await Promise.all(list.map(readAsDataUrl));
      setFormData(prev => ({
        ...prev,
        attachments: [
          ...(Array.isArray(prev.attachments) ? prev.attachments : []),
          ...newAttachments
        ]
      }));
    } catch (e) {
      console.error(e);
      alert('添付ファイルの読み込みに失敗しました');
    }
  };

  const handleRemoveAttachment = (index) => {
    setFormData(prev => {
      const next = Array.isArray(prev.attachments) ? prev.attachments.slice() : [];
      next.splice(index, 1);
      return { ...prev, attachments: next };
    });
  };
  
  const handleAddDivision = () => {
    const newId = `div_${Date.now().toString(36).toUpperCase()}`;
    const newDiv = { id: newId, label: '新しい部門', minRank: '', maxRank: '' };
    setFormData(prev => ({ ...prev, divisions: [...(prev.divisions || []), newDiv] }));
  };

  const handleRemoveDivision = (index) => {
    setFormData(prev => {
      const ds = (prev.divisions || []).slice();
      ds.splice(index, 1);
      return { ...prev, divisions: ds };
    });
  };

  const handleDivisionChange = (index, field, value) => {
    setFormData(prev => {
      const ds = (prev.divisions || []).map((d, i) => i === index ? { ...d, [field]: value } : d);
      return { ...prev, divisions: ds };
    });
  };
  const handleSaveTournament = async () => {
    if (!formData.name || !formData.datetime || !formData.location || !formData.purpose || !formData.organizer || !formData.coOrganizer || !formData.administrator || !formData.event || !formData.type || !formData.category || !formData.description || !formData.competitionMethod || !formData.award || !formData.qualifications || !formData.applicableRules || !formData.applicationMethod || !formData.remarks) { 
      alert('大会名、目的、主催、後援、主管、期日、会場、種目、種類、種別、内容、競技方法、表彰、参加資格、適用規則、申込方法、その他必要事項は必須です'); 
      return; 
    }
    
    try {
      const newId = isEditing && tournamentId ? tournamentId : generateTournamentId();

      setStoredAttachments(newId, formData.attachments);

      const { attachments, ...dataWithoutAttachments } = formData;
      
      const response = await fetch(`${API_URL}/tournaments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newId,
          data: dataWithoutAttachments
        })
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(`サーバー応答が不正です (status: ${response.status})`);
      }
      
      if (result.success) {
        setTournamentId(newId);
        setIsEditing(true);
        dispatch({ type: 'SAVE_TOURNAMENT_TEMPLATE', payload: { id: newId, data: dataWithoutAttachments } });
        dispatch({ type: 'UPDATE_TOURNAMENT_INFO', payload: { id: newId, name: dataWithoutAttachments.name } });
        alert(isEditing ? '大会情報を更新しました' : '大会を登録しました');
      } else {
        throw new Error(result.message || '保存に失敗しました');
      }
    } catch (error) {
      console.error('大会保存エラー:', error);
      alert(`大会の保存に失敗しました: ${error.message}`);
    }
  };
  
  const handleResetForm = () => {
    setFormData(normalizeTournamentFormData({}, defaultDivisions, []));
    setTournamentId(null);
    setIsEditing(false);
    setCopied(false);
    setGeocodeStatus('');
  };
  
  const handleDeleteTemplate = async (id) => {
    if (window.confirm('この大会情報を削除してもよろしいですか?')) {
      try {
        const response = await fetch(`${API_URL}/tournaments/${id}`, {
          method: 'DELETE'
        });
        const result = await response.json();
        if (result.success) {
          dispatch({ type: 'DELETE_TOURNAMENT_TEMPLATE', payload: id });
          if (tournamentId === id) handleResetForm();
        }
      } catch (error) {
        console.error('Error deleting tournament:', error);
        alert('削除に失敗しました');
      }
    }
  };
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(tournamentId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="view-container">
      <div className="admin-header">
        <h1>大会登録</h1>
      </div>
      <div className="view-content">
        {state.registeredTournaments.length > 0 && (
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <p className="card-title">登録済み大会</p>
              <input 
                type="text" 
                value={locationFilter} 
                onChange={(e) => setLocationFilter(e.target.value)} 
                placeholder="開催地でフィルター" 
                className="input input-sm w-48"
              />
            </div>
            <div className="tournament-list">
              {filteredTournaments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">該当する大会が見つかりません</p>
              ) : (
                filteredTournaments.map(template => (
                <div key={template.id} className="tournament-item">
                  <button onClick={() => handleLoadTemplateSafe(template)} className="tournament-button">
                    <p>{template.data.name}</p>
                    <p className="text-sm">{template.data.location || '場所未設定'} | {template.data.datetime || '日時未設定'}</p>
                  </button>
                  <button onClick={() => handleDeleteTemplate(template.id)} className="btn-delete">削除</button>
                </div>
              )))}
            </div>
            <button onClick={handleResetForm} className="btn-secondary">新規大会登録</button>
          </div>
        )}

        {tournamentId && (
          <div className="card">
            <div className="tournament-header">
              <div>
                <p className="text-sm text-gray-500">大会ID</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono">{tournamentId}</p>
                  <button 
                    onClick={copyToClipboard} 
                    className="p-1 hover:bg-gray-100 rounded"
                    title="コピー"
                  >
                    {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <input type="text" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="大会名 *" className="input" />
          <input type="datetime-local" value={formData.datetime} onChange={(e) => handleInputChange('datetime', e.target.value)} className="input" />
          <input type="text" value={formData.location} onChange={(e) => handleInputChange('location', e.target.value)} placeholder="開催場所 *" className="input" />
          <input type="text" value={formData.venueAddress} onChange={(e) => handleInputChange('venueAddress', e.target.value)} placeholder="会場住所（プログラム表には表示されません）" className="input" />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={handleGeocodeAddress} className="btn-secondary" disabled={isGeocoding} style={{ whiteSpace: 'nowrap' }}>
              {isGeocoding ? '取得中...' : '住所から座標取得'}
            </button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              {geocodeStatus && <p className="text-sm text-gray-600" style={{ margin: 0 }}>{geocodeStatus}</p>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input type="text" value={formData.venueLat} onChange={(e) => handleInputChange('venueLat', e.target.value)} placeholder="緯度（自動受付用）" className="input" />
            <input type="text" value={formData.venueLng} onChange={(e) => handleInputChange('venueLng', e.target.value)} placeholder="経度（自動受付用）" className="input" />
          </div>
          <input type="text" value={formData.purpose} onChange={(e) => handleInputChange('purpose', e.target.value)} placeholder="目的 *" className="input" />
          <input type="text" value={formData.organizer} onChange={(e) => handleInputChange('organizer', e.target.value)} placeholder="主催 *" className="input" />
          <input type="text" value={formData.coOrganizer} onChange={(e) => handleInputChange('coOrganizer', e.target.value)} placeholder="後援 *" className="input" />
          <input type="text" value={formData.administrator} onChange={(e) => handleInputChange('administrator', e.target.value)} placeholder="主管 *" className="input" />
          <div style={{ marginTop: '0.5rem' }}>
            <p className="label">添付資料（PDF/Excel/Word等・複数可）</p>
            <input
              type="file"
              multiple
              onChange={(e) => handleAttachmentsChange(e.target.files)}
              className="input"
            />
            {Array.isArray(formData.attachments) && formData.attachments.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                {formData.attachments.map((att, idx) => (
                  <div key={`${att?.name || 'file'}_${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <a href={att?.dataUrl || ''} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                      {att?.name || `file_${idx+1}`}
                    </a>
                    <button type="button" className="btn-fix" onClick={() => handleRemoveAttachment(idx)}>削除</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <p className="label">大会要項</p>
            <input type="text" value={formData.event} onChange={(e) => handleInputChange('event', e.target.value)} placeholder="種目 *" className="input" />
            <input type="text" value={formData.type} onChange={(e) => handleInputChange('type', e.target.value)} placeholder="種類 *" className="input" />
            <input type="text" value={formData.category} onChange={(e) => handleInputChange('category', e.target.value)} placeholder="種別 *" className="input" />
            <input type="text" value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} placeholder="内容 *" className="input" />
            <input type="text" value={formData.competitionMethod} onChange={(e) => handleInputChange('competitionMethod', e.target.value)} placeholder="競技方法 *" className="input" />
            <input type="text" value={formData.award} onChange={(e) => handleInputChange('award', e.target.value)} placeholder="表彰 *" className="input" />
            <input type="text" value={formData.qualifications} onChange={(e) => handleInputChange('qualifications', e.target.value)} placeholder="参加資格 *" className="input" />
            <input type="text" value={formData.applicableRules} onChange={(e) => handleInputChange('applicableRules', e.target.value)} placeholder="適用規則 *" className="input" />
            <input type="text" value={formData.applicationMethod} onChange={(e) => handleInputChange('applicationMethod', e.target.value)} placeholder="申込方法 *" className="input" />
            <input type="text" value={formData.remarks} onChange={(e) => handleInputChange('remarks', e.target.value)} placeholder="その他必要事項 *" className="input" />
            
            <div style={{ marginTop: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={formData.enableGenderSeparation || false}
                  onChange={(e) => handleInputChange('enableGenderSeparation', e.target.checked)}
                  style={{ width: '1rem', height: '1rem' }}
                />
                <span className="label">各部門で男女を分ける</span>
              </label>
              {formData.enableGenderSeparation && (
                <p className="text-sm text-gray-600" style={{ marginTop: '0.25rem' }}>
                  有効にすると、各部門で男と女の順位を別々に表示します
                </p>
              )}
            </div>
            
            <div style={{ marginTop: '0.75rem' }}>
              <p className="label">部門設定</p>
              {formData.divisions && (() => {
                const rankOptions = ['五級', '四級', '三級', '弐級', '壱級', '初段', '弐段', '参段', '四段', '五段', '錬士五段', '錬士六段', '教士七段', '教士八段', '範士八段', '範士九段'];
                return (
                  <>
                    {(formData.divisions || []).length === 0 && (
                      <p className="text-sm text-gray-500" style={{ marginBottom: '0.5rem' }}>部門がありません。「部門を追加」から追加してください。</p>
                    )}
                    {formData.divisions.map((d, idx) => (
                      <div key={d.id} className="division-row" style={{ marginBottom: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={d.label}
                          onChange={(e) => handleDivisionChange(idx, 'label', e.target.value)}
                          className="input"
                          style={{ flex: 1 }}
                        />
                        <select
                          value={d.minRank || ''}
                          onChange={(e) => handleDivisionChange(idx, 'minRank', e.target.value)}
                          className="input"
                          style={{ width: '10rem' }}
                        >
                          <option value="">from</option>
                          {rankOptions.map(r => (<option key={r} value={r}>{r}</option>))}
                        </select>
                        <select
                          value={d.maxRank || ''}
                          onChange={(e) => handleDivisionChange(idx, 'maxRank', e.target.value)}
                          className="input"
                          style={{ width: '10rem' }}
                        >
                          <option value="">to</option>
                          {rankOptions.map(r => (<option key={r} value={r}>{r}</option>))}
                        </select>
                        <div className="division-actions" style={{ display: 'flex', gap: '0.5rem', marginLeft: '0.5rem' }}>
                          <button type="button" className="btn-fix" onClick={() => handleRemoveDivision(idx)}>削除</button>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', marginTop: '0.5rem', gap: '0.5rem' }}>
                      <button type="button" className="btn-secondary" onClick={handleAddDivision}>部門を追加</button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        <button onClick={handleSaveTournament} className="btn-primary">{isEditing ? '大会情報を更新' : '大会登録を保存'}</button>
      </div>
    </div>
  );
};


export default TournamentSetupView;