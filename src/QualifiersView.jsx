import React, { useMemo, useCallback } from 'react';



const QualifiersView = ({ archers, tournament, getRankCategory, enableGenderSeparation, femaleFirst }) => {

  // 通過判定関数をメモ化

  const isPassed = useCallback((archer) => {

    // 結果が未設定の場合は即座に判定保留

    if (!archer.results?.stand1) return false;

    

    const results = archer.results.stand1;

    const currentRound = tournament?.currentRound || 1;

    const isFirstRound = currentRound === 1;

    const endIndex = isFirstRound ? (tournament?.arrowsRound1 || 0) : ((tournament?.arrowsRound1 || 0) + (tournament?.arrowsRound2 || 0));

    

    // 必要な部分だけを処理

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

    

    // 未入力の場合は不通過

    if (hasNull) return false;

    

    // 大会設定の通過ルールに基づいて判定

    const passRule = tournament?.passRule || 'all_four';

    const currentRoundArrows = isFirstRound ? (tournament?.arrowsRound1 || 0) : (tournament?.arrowsRound2 || 0);

    

    if (passRule === 'all_four') {

      return hitCount === currentRoundArrows;

    } else if (passRule === 'four_or_more') {

      return hitCount >= Math.min(4, currentRoundArrows);

    } else if (passRule === 'three_or_more') {

      return hitCount >= Math.min(3, currentRoundArrows);

    } else if (passRule === 'two_or_more') {

      return hitCount >= Math.min(2, currentRoundArrows);

    }

    

    // デフォルトは全て的中

    return hitCount === currentRoundArrows;

  }, [tournament]);



  // パフォーマンス向上のため、メモ化

  const passedArchers = useMemo(() => {

    if (!Array.isArray(archers)) return [];

    return archers.filter(archer => isPassed(archer));

  }, [archers, isPassed]);



  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '2px solid #e5e7eb' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.75rem' }}>✅</span>
            予選通過者一覧
          </h2>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            現在の通過者: <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>{passedArchers.length}</span>名
          </p>
        </div>
      </div>
      
      {enableGenderSeparation ? (
        <>
          {(() => {
            const maleArchers = passedArchers.filter(a => (a.gender || 'male') === 'male');
            const femaleArchers = passedArchers.filter(a => a.gender === 'female');
            const firstArchers = femaleFirst ? femaleArchers : maleArchers;
            const secondArchers = femaleFirst ? maleArchers : femaleArchers;
            const firstLabel = femaleFirst ? '女部門' : '男部門';
            const secondLabel = femaleFirst ? '男部門' : '女部門';
            const firstColor = femaleFirst ? '#fce7f3' : '#dbeafe';
            const secondColor = femaleFirst ? '#dbeafe' : '#fce7f3';
            
            return (
              <>
                {firstArchers.length > 0 && (
                  <div style={{ marginBottom: '2rem' }}>
                    <div style={{ padding: '0.75rem 1rem', backgroundColor: firstColor, borderRadius: '0.5rem', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#1f2937' }}>{firstLabel}</h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>通過者: {firstArchers.length}名</p>
                    </div>
                    <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                        <thead style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', borderBottom: '2px solid #10b981' }}>
                          <tr>
                            <th style={{ padding: '1rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>#</th>
                            <th style={{ padding: '1rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>氏名</th>
                            <th style={{ padding: '1rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>支部</th>
                            <th style={{ padding: '1rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>段位</th>
                          </tr>
                        </thead>
                        <tbody>
                          {firstArchers.map((archer, index) => {
                            const { ceremony, rank } = getRankCategory(archer.rank);
                            return (
                              <tr key={archer.archerId} style={{ borderBottom: '1px solid #d1fae5', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                <td style={{ padding: '1rem 0.75rem', fontSize: '1rem', fontWeight: 700, color: '#10b981', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  {index + 1}
                                </td>
                                <td style={{ padding: '1rem 0.75rem', fontWeight: 600, color: '#1f2937', fontSize: '1rem', whiteSpace: 'nowrap' }}>
                                  {archer.name}
                                </td>
                                <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                                  {archer.affiliation}
                                </td>
                                <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: '#6b7280', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  <span style={{ display: 'inline-block', padding: '0.25rem 0.75rem', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '0.375rem', fontWeight: 600 }}>
                                    {ceremony}{rank}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {secondArchers.length > 0 && (
                  <div>
                    <div style={{ padding: '0.75rem 1rem', backgroundColor: secondColor, borderRadius: '0.5rem', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#1f2937' }}>{secondLabel}</h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>通過者: {secondArchers.length}名</p>
                    </div>
                    <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                        <thead style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', borderBottom: '2px solid #10b981' }}>
                          <tr>
                            <th style={{ padding: '1rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>#</th>
                            <th style={{ padding: '1rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>氏名</th>
                            <th style={{ padding: '1rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>支部</th>
                            <th style={{ padding: '1rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>段位</th>
                          </tr>
                        </thead>
                        <tbody>
                          {secondArchers.map((archer, index) => {
                            const { ceremony, rank } = getRankCategory(archer.rank);
                            return (
                              <tr key={archer.archerId} style={{ borderBottom: '1px solid #d1fae5', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                <td style={{ padding: '1rem 0.75rem', fontSize: '1rem', fontWeight: 700, color: '#10b981', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  {index + 1}
                                </td>
                                <td style={{ padding: '1rem 0.75rem', fontWeight: 600, color: '#1f2937', fontSize: '1rem', whiteSpace: 'nowrap' }}>
                                  {archer.name}
                                </td>
                                <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                                  {archer.affiliation}
                                </td>
                                <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: '#6b7280', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  <span style={{ display: 'inline-block', padding: '0.25rem 0.75rem', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '0.375rem', fontWeight: 600 }}>
                                    {ceremony}{rank}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {firstArchers.length === 0 && secondArchers.length === 0 && (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '3rem', opacity: 0.3 }}>🎯</span>
                      <p style={{ margin: 0, color: '#9ca3af', fontSize: '1rem', fontWeight: 500 }}>通過者はまだいません</p>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
          <thead style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', borderBottom: '2px solid #10b981' }}>
            <tr>
              <th style={{ padding: '1rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>#</th>
              <th style={{ padding: '1rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>氏名</th>
              <th style={{ padding: '1rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>支部</th>
              <th style={{ padding: '1rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>段位</th>
              <th style={{ padding: '1rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>性別</th>
            </tr>
          </thead>
          <tbody>
            {passedArchers.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '3rem', opacity: 0.3 }}>🎯</span>
                    <p style={{ margin: 0, color: '#9ca3af', fontSize: '1rem', fontWeight: 500 }}>通過者はまだいません</p>
                  </div>
                </td>
              </tr>
            ) : (
              passedArchers.map((archer, index) => {
                const { ceremony, rank } = getRankCategory(archer.rank);
                return (
                  <tr key={archer.archerId} style={{ borderBottom: '1px solid #d1fae5', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '1rem 0.75rem', fontSize: '1rem', fontWeight: 700, color: '#10b981', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: '1rem 0.75rem', fontWeight: 600, color: '#1f2937', fontSize: '1rem', whiteSpace: 'nowrap' }}>
                      {archer.name}
                    </td>
                    <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      {archer.affiliation}
                    </td>
                    <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: '#6b7280', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-block', padding: '0.25rem 0.75rem', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '0.375rem', fontWeight: 600 }}>
                        {ceremony}{rank}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: '#6b7280', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-block', padding: '0.25rem 0.75rem', backgroundColor: archer.gender === 'female' ? '#fce7f3' : '#dbeafe', color: archer.gender === 'female' ? '#9f1239' : '#1e40af', borderRadius: '0.375rem', fontWeight: 600 }}>
                        {archer.gender === 'female' ? '👩 女' : '👨 男'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};


export default QualifiersView;
