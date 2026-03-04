// 距離計算（km）
export const distanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// 日付の差分を日数で計算
const daysDifference = (date1, date2) => {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// 座標＋日付で大会を自動選択
export const autoSelectTournamentByGeolocationAndDate = (tournaments, onSuccess, onError) => {
  if (!navigator.geolocation) {
    onError('❌ この端末は位置情報に対応していません');
    return;
  }

  onSuccess('🔄 位置情報を取得中...', null);
  
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      try {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const today = new Date();

        // 座標が登録されている大会を抽出し、距離と日付の差を計算
        const candidates = (tournaments || [])
          .map(t => {
            const tLat = Number(t?.data?.venueLat);
            const tLng = Number(t?.data?.venueLng);
            const tDate = t?.data?.datetime ? new Date(t.data.datetime) : null;
            
            if (!Number.isFinite(tLat) || !Number.isFinite(tLng)) return null;
            
            const dist = distanceKm(lat, lng, tLat, tLng);
            const dateDiff = tDate ? daysDifference(today, tDate) : 999;
            
            return { t, dist, dateDiff };
          })
          .filter(Boolean);

        if (candidates.length === 0) {
          onError('⚠️ 会場の緯度/経度が登録されている大会がありません');
          return;
        }

        // スコアリング: 距離50km以内かつ日付7日以内を優先
        // スコア = 距離(km) + 日付差(日) * 10
        const scored = candidates.map(c => ({
          ...c,
          score: c.dist + (c.dateDiff * 10)
        })).sort((a, b) => a.score - b.score);

        const best = scored[0];
        const message = `✅ 近い大会を自動選択しました（約${best.dist.toFixed(1)}km、${best.dateDiff}日${best.dateDiff === 0 ? '（本日）' : best.dateDiff > 0 ? '後' : '前'}）`;
        
        onSuccess(message, best.t.id);
      } catch (e) {
        console.error(e);
        onError('❌ 位置情報から大会の自動選択に失敗しました');
      }
    },
    (err) => {
      const msg = err?.message 
        ? `❌ 位置情報の取得に失敗しました: ${err.message}` 
        : '❌ 位置情報の取得に失敗しました';
      onError(msg);
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
  );
};
