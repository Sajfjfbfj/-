import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../utils/api';
import { groupByTeam, calculateTeamHitCount } from '../utils/teamCompetition';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { ensureJapaneseFont } from '../utils/jspdfJapaneseFont';

const TeamFinalsView = ({ state, selectedTournamentId }) => {
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [shootOffScores, setShootOffScores] = useState({});
  const [isShootOffActive, setIsShootOffActive] = useState(false);
  const [determinedTeams, setDeterminedTeams] = useState([]);
  const [tiedTeams, setTiedTeams] = useState([]);
  const [tournamentState, setTournamentState] = useState(null); // トーナメント表示用
  const tournamentTableRef = useRef(null);
  const rankingTableRef = useRef(null);

  const tournament = state.registeredTournaments.find(t => t.id === selectedTournamentId);
  const teamFinalsLimit = tournament?.data?.teamFinalsLimit || 8;

  // ---------- PDF エクスポート関数 ----------
  const exportTournamentToPDF = async () => {
    if (!tournamentState) {
      alert('トーナメントデータが見つかりません');
      return;
    }

    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      await ensureJapaneseFont(pdf);

      const ts = tournamentState;
      const topTeams = (() => {
        const teams = groupByTeam(archers);
        const scored = teams.map(t => ({
          ...t,
          totalHits: calculateTeamHitCount(t.members, tournament?.data || {})
        }));
        scored.sort((a, b) => b.totalHits - a.totalHits);
        return scored.slice(0, teamFinalsLimit);
      })();

      const tRounds = generateTournamentMatches(topTeams);
      const numRounds = tRounds.length;
      const finalRound = numRounds;
      const semiRound  = numRounds - 1;

      // 順位計算
      const finalMatch = ts.selectedTeams?.[`${finalRound}-1`] || {};
      const first  = tGetFinalWinner(finalRound, 1, ts);
      const second = first && finalMatch.team1 && finalMatch.team2
        ? (first.teamKey === finalMatch.team1.teamKey ? finalMatch.team2 : finalMatch.team1)
        : null;
      const semiRoundData = tRounds.find(r => r.roundNumber === semiRound);
      const thirds = semiRoundData
        ? semiRoundData.matches.map(m => {
            const w  = tGetFinalWinner(semiRound, m.matchNumber, ts);
            const sm = ts.selectedTeams?.[`${semiRound}-${m.matchNumber}`] || {};
            if (!w || !sm.team1 || !sm.team2) return null;
            return w.teamKey === sm.team1.teamKey ? sm.team2 : sm.team1;
          }).filter(Boolean)
        : [];

      // ─── レイアウト定数 ────────────────────────────────────────
      const pageW   = 297;
      const pageH   = 210;
      const leftM   = 12;   // 左余白を増やす
      const rightM  = 10;   // 右余白
      const topM    = 40;   // ヘッダー後余白を増やす
      const bottomM = 10;   // 下余白

      const availW = pageW - leftM - rightM;   // 275
      const availH = pageH - topM - bottomM;   // 160

      // スロット（チーム行）の数と高さ
      const numSlots = Math.pow(2, numRounds);
      const slotH    = availH / numSlots;  // 高さを増やす

      // 列幅（見やすくするために調整）
      const seedW    = 8;    // シード番号（少し広げる）
      const nameW    = 45;   // チーム名（広げる）
      const preW     = 10;   // 予選スコア（広げる）
      const teamColW = seedW + nameW + preW;   // 63mm
      const resultW  = 45;   // 右端の結果欄（広げる）
      const bracketW = availW - teamColW - resultW;  // ブラケット幅
      const roundW   = bracketW / numRounds;          // 1ラウンド分

      // x 座標ヘルパー
      const xTeamLeft   = leftM;
      const xBracketL   = leftM + teamColW;
      // round r(0始まり) の縦ブラケット線 x
      const xVert = (r) => xBracketL + (r + 1) * roundW;
      const xResultL    = xBracketL + numRounds * roundW;

      // スロット i の y 中心
      const ySlot = (i) => topM + (i + 0.5) * slotH;

      // ラウンド r(0始まり)・試合 j(0始まり) の上/下/中央 y を再帰的に計算
      const getYs = (r, j) => {
        if (r === 0) {
          const yT = ySlot(j * 2);
          const yB = ySlot(j * 2 + 1);
          return { yT, yB, yM: (yT + yB) / 2 };
        }
        const { yM: yT } = getYs(r - 1, j * 2);
        const { yM: yB } = getYs(r - 1, j * 2 + 1);
        return { yT, yB, yM: (yT + yB) / 2 };
      };

      // 1回戦スロットへのチームマッピング
      const slotTeam = new Array(numSlots).fill(null);
      tRounds[0]?.matches.forEach((m) => {
        const sm = ts.selectedTeams?.[`1-${m.matchNumber}`] || {};
        slotTeam[(m.matchNumber - 1) * 2]     = sm.team1 || null;
        slotTeam[(m.matchNumber - 1) * 2 + 1] = sm.team2 || null;
      });

      // ─── ページ1 ヘッダー ─────────────────────────────────────
      pdf.setFontSize(20);  // フォントサイズをさらに大きく
      const tName = tournament?.data?.name || tournament?.name || '弓道大会';
      pdf.text(`${tName} 成績表`, pageW / 2, 12, { align: 'center' });

      pdf.setFontSize(12);  // 日付もさらに大きく
      const dStr = tournament?.data?.date
        ? new Date(tournament.data.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
        : new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
      pdf.text(dStr, pageW / 2, 20, { align: 'center' });
      if (tournament?.data?.location) {
        pdf.setFontSize(11);
        pdf.text(tournament.data.location, pageW / 2, 27, { align: 'center' });
      }

      // ラウンド名ラベル（より目立つように）
      pdf.setFontSize(11);  // さらに大きく
      pdf.setTextColor(0, 0, 0);  // 黒に
      tRounds.forEach((round, ri) => {
        pdf.text(round.roundName, xBracketL + (ri + 0.5) * roundW, topM - 4, { align: 'center' });
      });
      pdf.setTextColor(0, 0, 0);  // 黒に戻す

      // 区切り線（より目立つように）
      pdf.setDrawColor(0, 0, 0);  // 黒に
      pdf.setLineWidth(1.0);  // 太く
      pdf.line(leftM, topM - 2, pageW - rightM, topM - 2);
      pdf.line(leftM, topM + availH, pageW - rightM, topM + availH);

      // ─── チーム列 ─────────────────────────────────────────────
      pdf.setLineWidth(0.8);  // 線をさらに太く
      for (let i = 0; i < numSlots; i++) {
        const y    = ySlot(i);
        const team = slotTeam[i];

        if (team) {
          // シード番号（より目立つように）
          pdf.setFontSize(10);  // さらに大きく
          pdf.setTextColor(0, 0, 0);  // 黒に
          pdf.text(`${i + 1}`, xTeamLeft + seedW - 1, y + 1, { align: 'right' });

          // チーム名（より大きく）
          pdf.setFontSize(14);  // さらに大きく
          pdf.setTextColor(0, 0, 0);  // 黒
          const nm = (team.teamName || '').length > 10  // 文字数制限を増やす
            ? (team.teamName || '').slice(0, 10) + '…'
            : (team.teamName || '');
          pdf.text(nm, xTeamLeft + seedW + 2, y + 1);

          // 予選スコア（より目立つように）
          pdf.setFontSize(12);  // さらに大きく
          pdf.setTextColor(0, 0, 0);  // 黒に
          pdf.text(`${team.totalHits}`, xTeamLeft + teamColW - 2, y + 1, { align: 'right' });
          pdf.setTextColor(0, 0, 0);
        }

        // チーム列 → 第1縦線 への横線（より目立つように）
        pdf.setDrawColor(0, 0, 0);  // 黒に
        pdf.setLineWidth(0.8);  // さらに太く
        pdf.line(xBracketL, y, xVert(0), y);
      }

      // ─── ブラケット線 + スコア ────────────────────────────────
      for (let r = 0; r < numRounds; r++) {
        const numM = Math.pow(2, numRounds - r - 1);

        for (let j = 0; j < numM; j++) {
          const { yT, yB, yM } = getYs(r, j);
          const rn = r + 1;   // roundNumber (1始まり)
          const mn = j + 1;   // matchNumber (1始まり)

          // 縦ブラケット線（全ラウンド描画。決勝も入口2本を繋ぐ縦線が必要）
          pdf.setDrawColor(0, 0, 0);
          pdf.setLineWidth(1.0);
          pdf.line(xVert(r), yT, xVert(r), yB);

          // 出口横線（次ラウンド入口 or 結果欄へ）
          const xEnd = r < numRounds - 1 ? xVert(r + 1) : xResultL + 10;  // 結果欄内側まで延長
          pdf.line(xVert(r), yM, xEnd, yM);

          // スコア取得
          const matchKey = `${rn}-${mn}`;
          const sm     = ts.selectedTeams?.[matchKey] || {};
          const winner = tGetFinalWinner(rn, mn, ts);

          // 上チームのスコア（より大きく、目立つように）
          if (sm.team1) {
            const sc  = tGetMatchScore(rn, mn, sm.team1.teamKey, ts);
            const so  = tGetShootOffScore(rn, mn, sm.team1.teamKey, ts);
            if (sc !== null) {
              const isW = winner?.teamKey === sm.team1.teamKey;
              pdf.setFontSize(13);  // さらに大きく
              if (isW) {
                pdf.setTextColor(0, 100, 0);  // 濃い緑
              } else {
                pdf.setTextColor(0, 0, 0);  // 黒に
              }
              const str = (so !== null && so > 0) ? `${sc}(${so})` : `${sc}`;
              pdf.text(str, xVert(r) - 2, yT - 1, { align: 'right' });
              pdf.setTextColor(0, 0, 0);
            }
          }

          // 下チームのスコア（より大きく）
          if (sm.team2) {
            const sc  = tGetMatchScore(rn, mn, sm.team2.teamKey, ts);
            const so  = tGetShootOffScore(rn, mn, sm.team2.teamKey, ts);
            if (sc !== null) {
              const isW = winner?.teamKey === sm.team2.teamKey;
              pdf.setFontSize(13);  // さらに大きく
              if (isW) {
                pdf.setTextColor(0, 100, 0);  // 濃い緑
              } else {
                pdf.setTextColor(0, 0, 0);  // 黒に
              }
              const str = (so !== null && so > 0) ? `${sc}(${so})` : `${sc}`;
              pdf.text(str, xVert(r) - 2, yB - 1, { align: 'right' });
              pdf.setTextColor(0, 0, 0);
            }
          }

          // 勝者チーム名（出口横線の上、次ラウンドが存在する場合）（より大きく）
          if (winner && r < numRounds - 1) {
            pdf.setFontSize(12);  // さらに大きく
            pdf.setTextColor(0, 100, 0);  // 濃い緑
            const wn = (winner.teamName || '').length > 8  // 文字数制限を増やす
              ? (winner.teamName || '').slice(0, 8) + '…'
              : (winner.teamName || '');
            pdf.text(wn, xVert(r) + 3, yM - 1);
            pdf.setTextColor(0, 0, 0);
          }
        }
      }

      // ─── 結果欄 ──────────────────────────────────────────────
      // 縦区切り線（より目立つように）
      const yFinalMid = getYs(numRounds - 1, 0).yM;

      // 準決勝の敗者y
      const semiMidYs = [];
      if (numRounds >= 2) {
        const numSemiMatches = Math.pow(2, numRounds - semiRound);
        for (let j = 0; j < numSemiMatches; j++) {
          semiMidYs.push(getYs(numRounds - 2, j).yM);
        }
      }

      const xResRight = xResultL + 16;
      const boxX = xResRight - 3;
      const boxW = pageW - rightM - boxX;
      const rowH = 14;
      const yBase = yFinalMid;

      // 枠と背景を描画するヘルパー
      const drawResultRow = (label, teamName, y, bgR, bgG, bgB) => {
        if (!teamName) return;
        // 背景
        pdf.setFillColor(bgR, bgG, bgB);
        pdf.rect(boxX, y - 8, boxW, rowH, 'F');
        // 枠線
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.5);
        pdf.rect(boxX, y - 8, boxW, rowH, 'S');
        // テキスト
        pdf.setFontSize(10);
        pdf.setTextColor(80, 80, 80);
        pdf.text(label, xResRight, y - 1);
        pdf.setFontSize(13);
        pdf.setTextColor(0, 0, 0);
        const n = teamName.length > 10 ? teamName.slice(0, 10) + '…' : teamName;
        pdf.text(n, xResRight, y + 5);
      };

      // 3位は2チームを「チームA・チームB」でまとめる
      const thirdNames = thirds.map(t => t.teamName).join('・');

      drawResultRow('優勝',   first?.teamName  ?? '', yBase,        255, 249, 196);  // 金
      drawResultRow('準優勝', second?.teamName ?? '', yBase + rowH, 240, 240, 240);  // 銀
      if (thirdNames) drawResultRow('3位', thirdNames, yBase + rowH * 2, 255, 235, 205);  // 銅

      // ─── ページ2：最終順位表 ─────────────────────────────────
      if (first && second) {
        pdf.addPage();
        await ensureJapaneseFont(pdf);

        pdf.setFontSize(18);  // さらに大きく
        pdf.text('最終順位', pageW / 2, 18, { align: 'center' });

        let ry = 35;
        const cols = [18, 45, 110, 175];  // 列位置を調整
        const rowH = 14;  // 行の高さをさらに増やす

        // ヘッダー（より目立つように）
        pdf.setFillColor(100, 100, 100);  // より濃いグレー
        pdf.rect(cols[0], ry - 6, 260, rowH, 'F');  // 幅を広げる
        pdf.setFontSize(12);  // さらに大きく
        pdf.setTextColor(0, 0, 0);
        ['順位', 'チーム名', '所属', 'メンバー'].forEach((h, i) => pdf.text(h, cols[i], ry));
        ry += rowH + 2;

        const drawRow = (rank, team, bgR, bgG, bgB) => {
          if (!team) return;
          pdf.setFillColor(bgR, bgG, bgB);
          pdf.rect(cols[0], ry - 6, 260, rowH, 'F');  // 幅を広げる
          pdf.setFontSize(12);  // さらに大きく
          pdf.setTextColor(0, 0, 0);
          pdf.text(rank, cols[0], ry);
          pdf.text(team.teamName || '', cols[1], ry);
          pdf.text(team.affiliation || '', cols[2], ry);
          const members = (team.members?.map(m => m.name).join('・') || '').slice(0, 50);  // 文字数制限を増やす
          pdf.text(members, cols[3], ry);
          ry += rowH + 2;
        };

        drawRow('優勝',  first,  255, 251, 190);  // 金色
        drawRow('準優勝', second, 235, 235, 235);  // 銀色
        thirds.forEach(t => drawRow('3位', t, 255, 234, 210));  // 銅色
      }

      // フッター（生成日時を追加）
      pdf.setFontSize(8);
      pdf.setTextColor(0, 0, 0);
      const footerText = `生成日時: ${new Date().toLocaleString('ja-JP')}`;
      pdf.text(footerText, leftM, pageH - 8);

      const now = new Date();
      pdf.save(`決勝トーナメント表_${now.toISOString().slice(0, 10)}.pdf`);
      alert('PDFをダウンロードしました');

    } catch (error) {
      console.error('PDF生成エラー:', error);
      alert('PDFの生成に失敗しました: ' + error.message);
    }
  };

  // ---------- Excel エクスポート関数 ----------
  const exportRankingToExcel = () => {
    if (!rankingTableRef.current) {
      alert('最終順位表が見つかりません');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();
      
      // 最終順位表のデータを抽出
      const rows = [];
      const tableRows = rankingTableRef.current.querySelectorAll('tbody tr');
      
      // ヘッダー
      rows.push(['順位', 'チーム名', '所属', 'メンバー']);
      
      // データ行
      tableRows.forEach(tr => {
        const cells = tr.querySelectorAll('td');
        if (cells.length >= 4) {
          rows.push([
            cells[0].textContent.trim(),
            cells[1].textContent.trim(),
            cells[2].textContent.trim(),
            cells[3].textContent.trim()
          ]);
        }
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      
      // 列幅を調整
      ws['!cols'] = [
        { wch: 12 },  // 順位
        { wch: 20 },  // チーム名
        { wch: 25 },  // 所属
        { wch: 35 }   // メンバー
      ];

      XLSX.utils.book_append_sheet(wb, ws, '最終順位');

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      XLSX.writeFile(wb, `最終順位_${dateStr}.xlsx`);
      alert('Excelをダウンロードしました');
    } catch (error) {
      console.error('Excel生成エラー:', error);
      alert('Excelの生成に失敗しました');
    }
  };

  // ---------- トーナメント表ロジック ----------

  const generateTournamentMatches = (teams) => {
    if (teams.length === 0) return [];
    const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(teams.length)));
    const numRounds = Math.log2(nextPowerOfTwo);
    const rounds = [];
    for (let round = 0; round < numRounds; round++) {
      const numMatches = Math.pow(2, numRounds - round - 1);
      const matches = [];
      for (let i = 0; i < numMatches; i++) {
        matches.push({ round, matchNumber: i + 1 });
      }
      rounds.push({
        roundNumber: round + 1,
        roundName: round === numRounds - 1 ? '決勝' : round === numRounds - 2 ? '準決勝' : `${round + 1}回戦`,
        matches
      });
    }
    return rounds;
  };

  const tDetermineWinner = (round, matchNum, ts) => {
    const matchKey = `${round}-${matchNum}`;
    const scores = ts.matchScores?.[matchKey];
    if (!scores) return null;
    const teams = Object.keys(scores);
    if (teams.length !== 2) return null;
    const s1 = scores[teams[0]];
    const s2 = scores[teams[1]];
    if ((s1.totalShots || 0) >= 12 && (s2.totalShots || 0) >= 12) {
      if (s1.hits > s2.hits) return teams[0];
      if (s2.hits > s1.hits) return teams[1];
      return 'shootoff';
    }
    return null;
  };

  const tDetermineShootOffWinner = (round, matchNum, team1Key, team2Key, ts) => {
    const matchKey = `${round}-${matchNum}`;
    const matchSOScores = ts.shootOffScores?.[matchKey] || {};
    const score1 = matchSOScores[team1Key];
    const score2 = matchSOScores[team2Key];
    if (!score1 || !score2) return null;
    const sm = ts.selectedTeams?.[matchKey] || {};
    const memberCount = sm.team1?.members?.length || 3;
    const soRound = ts.shootOffRounds?.[matchKey] || 1;
    if ((score1.totalShots || 0) < memberCount * soRound) return null;
    if ((score2.totalShots || 0) < memberCount * soRound) return null;
    const h1 = score1.rounds?.[soRound] || 0;
    const h2 = score2.rounds?.[soRound] || 0;
    if (h1 > h2) return team1Key;
    if (h2 > h1) return team2Key;
    return 'next-round';
  };

  const tGetFinalWinner = (round, matchNum, ts) => {
    const matchKey = `${round}-${matchNum}`;
    const sm = ts.selectedTeams?.[matchKey] || {};
    if (!sm.team1 || !sm.team2) return null;
    const winner = tDetermineWinner(round, matchNum, ts);
    if (winner && winner !== 'shootoff') {
      return winner === sm.team1.teamKey ? sm.team1 : sm.team2;
    }
    if (winner === 'shootoff' || ts.shootOffStarted?.[matchKey]) {
      const soWinner = tDetermineShootOffWinner(round, matchNum, sm.team1.teamKey, sm.team2.teamKey, ts);
      if (soWinner && soWinner !== 'next-round') {
        return soWinner === sm.team1.teamKey ? sm.team1 : sm.team2;
      }
    }
    return null;
  };

  const tGetMatchScore = (round, matchNum, teamKey, ts) =>
    ts.matchScores?.[`${round}-${matchNum}`]?.[teamKey]?.hits ?? null;

  const tGetShootOffScore = (round, matchNum, teamKey, ts) =>
    ts.shootOffScores?.[`${round}-${matchNum}`]?.[teamKey]?.hits ?? null;

  // ── 運営用と完全に同じロジック ──────────────────────────────────────
  const getTeamRankings = () => {
    const teams = groupByTeam(archers);
    const teamScores = teams.map(team => ({
      ...team,
      totalHits: calculateTeamHitCount(team.members, tournament?.data || {})  // 修正: 運営用と同じ引数
    }));

    teamScores.sort((a, b) => b.totalHits - a.totalHits);

    const rankings = [];
    let currentRank = 1;
    let prevScore = null;

    teamScores.forEach((team, index) => {
      if (prevScore !== null && team.totalHits !== prevScore) {
        currentRank = index + 1;
      }
      rankings.push({ ...team, rank: currentRank });
      prevScore = team.totalHits;
    });

    return rankings;
  };

  const getFinalists = () => {
    const rankings = getTeamRankings();
    const finalists = [];
    let borderlineTeams = [];
    let borderRank = null;

    if (rankings.length === 0) {
      return { finalists, needsShootOff: false, tiedTeams: [], borderRank: null };
    }

    const limitIndex = teamFinalsLimit - 1;
    const limitHits = rankings[limitIndex]?.totalHits;
    if (limitHits === undefined) {
      // 出場チームが制限未満の場合、全員進出
      return { finalists: [...rankings], needsShootOff: false, tiedTeams: [], borderRank: null };
    }

    // limitHitsより多い的中数のチームは確定進出
    rankings.forEach(team => {
      if (team.totalHits > limitHits) {
        finalists.push(team);
      } else if (team.totalHits === limitHits) {
        borderlineTeams.push(team);
      }
    });

    // 境界ランク（表示用）
    if (borderlineTeams.length > 0) {
      borderRank = borderlineTeams[0].rank;
    }

    const spotsLeft = teamFinalsLimit - finalists.length;
    const needsShootOff = borderlineTeams.length > spotsLeft;

    if (needsShootOff) {
      const withShootOff = borderlineTeams.map(team => ({
        ...team,
        shootOffScore: shootOffScores[team.teamKey] || 0,
        finalScore: team.totalHits + (shootOffScores[team.teamKey] || 0)
      }));
      withShootOff.sort((a, b) => b.finalScore - a.finalScore);
      return { finalists, needsShootOff: true, tiedTeams: withShootOff, borderRank };
    }

    // 競射不要なら全borderlineを決勝進出に含める
    finalists.push(...borderlineTeams);
    return { finalists, needsShootOff: false, tiedTeams: [], borderRank };
  };
  // ───────────────────────────────────────────────────────────────────

  const rankings = getTeamRankings();
  const finalistsResult = getFinalists();
  const confirmedFinalists = finalistsResult.finalists;
  const borderlineTeams = finalistsResult.needsShootOff ? finalistsResult.tiedTeams : [];

  // サーバーから競射結果を読み込み（shootOffScores も取得）
  const loadShootOffResults = async () => {
    if (!selectedTournamentId) return;
    try {
      const response = await fetch(`${API_URL}/team/shootoff/${selectedTournamentId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.data) {
          const data = result.data;
          setShootOffScores(data.shootOffScores || {});   // 追加
          setDeterminedTeams(data.determinedTeams || []);
          setTiedTeams(data.tiedTeams || []);
          setIsShootOffActive(data.isShootOffActive || false);
        }
      }
    } catch (error) {
      console.error('競射結果の読み込みに失敗しました:', error);
    }
  };

  useEffect(() => {
    if (selectedTournamentId) {
      fetchArchers();
      loadShootOffResults();
      loadTournamentState();
    }
  }, [selectedTournamentId]);

  const loadTournamentState = async () => {
    try {
      const res = await fetch(`${API_URL}/team-tournament-state/${selectedTournamentId}`);
      const result = await res.json();
      if (result.success && result.data) setTournamentState(result.data);
    } catch (e) {
      console.error('トーナメント状態取得エラー:', e);
    }
  };

  const fetchArchers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/applicants/${selectedTournamentId}`);
      const result = await response.json();
      if (result.success) {
        setArchers(result.data.filter(a => a.isCheckedIn));
      }
    } catch (error) {
      console.error('選手データ取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-center mb-6 text-blue-800">
          🏆 決勝進出チーム
        </h1>

        {archers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">チェックインした選手がいません</p>
          </div>
        ) : (
          <>
            {/* 決勝進出確定チーム表 */}
            {(confirmedFinalists.length > 0 || determinedTeams.length > 0) && (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h2 className="card-title text-green-700 text-lg sm:text-xl">✅ 決勝進出確定チーム（{confirmedFinalists.length + determinedTeams.length}チーム）</h2>
                  <button
                    onClick={() => window.print()}
                    className="btn-primary text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-2"
                  >
                    🖨️ 印刷
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-green-300 text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-green-100">
                        <th className="border border-green-300 px-2 sm:px-4 py-1 sm:py-2">チーム名</th>
                        <th className="border border-green-300 px-2 sm:px-4 py-1 sm:py-2">所属</th>
                        <th className="border border-green-300 px-2 sm:px-4 py-1 sm:py-2">予選的中</th>
                        <th className="border border-green-300 px-2 sm:px-4 py-1 sm:py-2">メンバー</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...confirmedFinalists, ...determinedTeams].map(team => (
                        <tr key={team.teamKey} className="hover:bg-green-50">
                          <td className="border border-green-300 px-2 sm:px-4 py-1 sm:py-2 font-semibold text-sm">{team.teamName}</td>
                          <td className="border border-green-300 px-2 sm:px-4 py-1 sm:py-2 text-sm">{team.affiliation}</td>
                          <td className="border border-green-300 px-2 sm:px-4 py-1 sm:py-2 text-center font-bold text-sm">{team.totalHits}本</td>
                          <td className="border border-green-300 px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm">{team.members.map(m => m.name).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* 全枠確定時の完了メッセージ */}
                {confirmedFinalists.length + determinedTeams.length >= teamFinalsLimit && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: '#d1fae5', borderRadius: '0.5rem', border: '2px solid #10b981', textAlign: 'center' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: 700, color: '#059669' }}>
                      🎉 トーナメント進出チームが確定しました！
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#047857' }}>
                      上位{teamFinalsLimit}チームが決勝トーナメントに進出します
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 競射が完了して全枠が確定した場合はボーダーラインチームを表示しない（運営用と同じ条件） */}
            {borderlineTeams.length > 0 && confirmedFinalists.length + determinedTeams.length < teamFinalsLimit && (
              <div className="card" style={{ marginTop: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h2 className="card-title text-orange-700 text-lg sm:text-xl">🎯 決勝トーナメント進出戦一覧（{borderlineTeams.length}チーム）</h2>
                  <button
                    onClick={() => window.print()}
                    className="btn-primary text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-2"
                  >
                    🖨️ 印刷
                  </button>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#92400e', marginBottom: '1rem' }}>
                  {finalistsResult.borderRank}位で同率のため、1人1射の競射を実施
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-orange-300 text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-orange-100">
                        <th className="border border-orange-300 px-2 sm:px-4 py-1 sm:py-2">チーム名</th>
                        <th className="border border-orange-300 px-2 sm:px-4 py-1 sm:py-2">所属</th>
                        <th className="border border-orange-300 px-2 sm:px-4 py-1 sm:py-2">予選的中</th>
                        {isShootOffActive && <th className="border border-orange-300 px-2 sm:px-4 py-1 sm:py-2">競射的中</th>}
                        {isShootOffActive && <th className="border border-orange-300 px-2 sm:px-4 py-1 sm:py-2">合計</th>}
                        <th className="border border-orange-300 px-2 sm:px-4 py-1 sm:py-2">メンバー</th>
                      </tr>
                    </thead>
                    <tbody>
                      {borderlineTeams.map(team => (
                        <tr key={team.teamKey} className="hover:bg-orange-50">
                          <td className="border border-orange-300 px-2 sm:px-4 py-1 sm:py-2 font-semibold text-sm">{team.teamName}</td>
                          <td className="border border-orange-300 px-2 sm:px-4 py-1 sm:py-2 text-sm">{team.affiliation}</td>
                          <td className="border border-orange-300 px-2 sm:px-4 py-1 sm:py-2 text-center font-bold text-sm">{team.totalHits}本</td>
                          {isShootOffActive && <td className="border border-orange-300 px-2 sm:px-4 py-1 sm:py-2 text-center font-bold text-blue-700 text-sm">{team.shootOffScore || 0}本</td>}
                          {isShootOffActive && <td className="border border-orange-300 px-2 sm:px-4 py-1 sm:py-2 text-center font-bold text-green-700 text-sm">{team.finalScore}本</td>}
                          <td className="border border-orange-300 px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm">{team.members.map(m => m.name).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ========== 決勝トーナメント表 ========== */}
            {tournamentState && (() => {
              const ts = tournamentState;
              const topTeams = (() => {
                const teams = groupByTeam(archers);
                const scored = teams.map(t => ({
                  ...t,
                  totalHits: calculateTeamHitCount(t.members, tournament?.data || {})
                }));
                scored.sort((a, b) => b.totalHits - a.totalHits);
                return scored.slice(0, teamFinalsLimit);
              })();
              const tRounds = generateTournamentMatches(topTeams);
              if (tRounds.length === 0) return null;

              const totalRounds = tRounds.length;
              const finalRound = totalRounds;
              const semiRound  = totalRounds - 1;

              // 順位計算
              const finalMatch = ts.selectedTeams?.[`${finalRound}-1`] || {};
              const first  = tGetFinalWinner(finalRound, 1, ts);
              const second = first && finalMatch.team1 && finalMatch.team2
                ? (first.teamKey === finalMatch.team1.teamKey ? finalMatch.team2 : finalMatch.team1)
                : null;
              const semiRoundData = tRounds.find(r => r.roundNumber === semiRound);
              const thirds = semiRoundData
                ? semiRoundData.matches.map(m => {
                    const w  = tGetFinalWinner(semiRound, m.matchNumber, ts);
                    const sm = ts.selectedTeams?.[`${semiRound}-${m.matchNumber}`] || {};
                    if (!w || !sm.team1 || !sm.team2) return null;
                    return w.teamKey === sm.team1.teamKey ? sm.team2 : sm.team1;
                  }).filter(Boolean)
                : [];

              // 試合カード
              const MatchCard = ({ round, matchNum }) => {
                const matchKey = `${round}-${matchNum}`;
                const sm     = ts.selectedTeams?.[matchKey] || {};
                const winner = tGetFinalWinner(round, matchNum, ts);

                const TeamRow = ({ team }) => {
                  if (!team) return (
                    <div style={{ padding: '4px 8px', color: '#9ca3af', fontSize: '0.8rem' }}>---</div>
                  );
                  const score   = tGetMatchScore(round, matchNum, team.teamKey, ts);
                  const soScore = tGetShootOffScore(round, matchNum, team.teamKey, ts);
                  const isWin   = winner?.teamKey === team.teamKey;
                  return (
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '4px 8px',
                      background: isWin ? '#dcfce7' : '#fff',
                      borderLeft: isWin ? '3px solid #16a34a' : '3px solid transparent',
                    }}>
                      <span style={{ fontWeight: isWin ? 700 : 400, fontSize: '0.82rem', color: isWin ? '#15803d' : '#1f2937' }}>
                        {isWin && '🏆 '}{team.teamName}
                        <span style={{ fontSize: '0.7rem', color: '#6b7280', marginLeft: 4 }}>({team.totalHits})</span>
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1d4ed8', minWidth: 32, textAlign: 'right' }}>
                        {score !== null ? `${score}` : ''}
                        {soScore !== null && soScore > 0
                          ? <span style={{ color: '#f97316', fontSize: '0.7rem' }}>({soScore})</span>
                          : null}
                      </span>
                    </div>
                  );
                };

                return (
                  <div style={{
                    border: '1px solid #d1d5db', borderRadius: 6,
                    overflow: 'hidden', background: '#f9fafb',
                    minWidth: 200, marginBottom: 8,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                  }}>
                    <div style={{ background: '#e5e7eb', padding: '2px 8px', fontSize: '0.7rem', color: '#6b7280' }}>
                      試合 {matchNum}
                    </div>
                    <TeamRow team={sm.team1} />
                    <div style={{ borderTop: '1px solid #e5e7eb' }} />
                    <TeamRow team={sm.team2} />
                  </div>
                );
              };

              return (
                <div className="card" style={{ marginTop: '2rem' }} ref={tournamentTableRef}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h2 className="card-title text-lg sm:text-xl">🏹 決勝トーナメント表</h2>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      <button onClick={loadTournamentState} className="btn-secondary text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-2">
                        🔄 更新
                      </button>
                      <button onClick={exportTournamentToPDF} className="btn-secondary text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-2" style={{ background: '#dc2626', color: 'white' }}>
                        📥 PDF
                      </button>
                      <button onClick={() => window.print()} className="btn-primary text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-2">
                        🖨️ 印刷
                      </button>
                    </div>
                  </div>

                  {/* ブラケット横並び */}
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <div style={{ display: 'flex', gap: window.innerWidth < 768 ? 16 : 32, alignItems: 'flex-start', minWidth: 'max-content', padding: '0 4px 8px' }}>
                      {tRounds.map((round) => (
                        <div key={round.roundNumber} style={{ display: 'flex', flexDirection: 'column', minWidth: window.innerWidth < 768 ? '120px' : 'auto' }}>
                          <div style={{
                            textAlign: 'center', fontWeight: 700, fontSize: window.innerWidth < 768 ? '0.75rem' : '0.875rem',
                            color: '#1e40af', marginBottom: window.innerWidth < 768 ? 6 : 10,
                            background: '#eff6ff', borderRadius: 4, padding: window.innerWidth < 768 ? '2px 8px' : '3px 12px'
                          }}>
                            {round.roundName}
                          </div>
                          <div style={{
                            display: 'flex', flexDirection: 'column',
                            gap: Math.pow(2, round.roundNumber - 1) * (window.innerWidth < 768 ? 4 : 8)
                          }}>
                            {round.matches.map(m => (
                              <MatchCard key={m.matchNumber} round={round.roundNumber} matchNum={m.matchNumber} />
                            ))}
                          </div>
                        </div>
                      ))}

                      {/* 最終結果列 */}
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: window.innerWidth < 768 ? '100px' : '120px' }}>
                        <div style={{
                          textAlign: 'center', fontWeight: 700, fontSize: window.innerWidth < 768 ? '0.75rem' : '0.875rem',
                          color: '#15803d', marginBottom: window.innerWidth < 768 ? 6 : 10,
                          background: '#f0fdf4', borderRadius: 4, padding: window.innerWidth < 768 ? '2px 8px' : '3px 12px'
                        }}>
                          結果
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: window.innerWidth < 768 ? 4 : 6 }}>
                          {first && (
                            <div style={{
                              padding: window.innerWidth < 768 ? '4px 8px' : '6px 14px',
                              background: '#fef9c3', border: '2px solid #eab308', borderRadius: 6, textAlign: 'center'
                            }}>
                              <div style={{ fontSize: window.innerWidth < 768 ? '0.9rem' : '1.1rem' }}>🥇</div>
                              <div style={{ fontWeight: 700, fontSize: window.innerWidth < 768 ? '0.7rem' : '0.9rem', color: '#92400e' }}>{first.teamName}</div>
                              <div style={{ fontSize: window.innerWidth < 768 ? '0.6rem' : '0.7rem', color: '#a16207' }}>優勝</div>
                            </div>
                          )}
                          {second && (
                            <div style={{
                              padding: window.innerWidth < 768 ? '4px 8px' : '6px 14px',
                              background: '#f3f4f6', border: '2px solid #9ca3af', borderRadius: 6, textAlign: 'center'
                            }}>
                              <div style={{ fontSize: window.innerWidth < 768 ? '0.9rem' : '1.1rem' }}>🥈</div>
                              <div style={{ fontWeight: 700, fontSize: window.innerWidth < 768 ? '0.7rem' : '0.9rem', color: '#374151' }}>{second.teamName}</div>
                              <div style={{ fontSize: window.innerWidth < 768 ? '0.6rem' : '0.7rem', color: '#6b7280' }}>準優勝</div>
                            </div>
                          )}
                          {thirds.length > 0 && (
                            <div style={{
                              padding: window.innerWidth < 768 ? '4px 8px' : '6px 14px',
                              background: '#fff7ed', border: '2px solid #f97316', borderRadius: 6, textAlign: 'center'
                            }}>
                              <div style={{ fontSize: window.innerWidth < 768 ? '0.9rem' : '1.1rem' }}>🥉</div>
                              {thirds.map(t => (
                                <div key={t.teamKey} style={{ fontWeight: 600, fontSize: window.innerWidth < 768 ? '0.65rem' : '0.85rem', color: '#9a3412' }}>{t.teamName}</div>
                              ))}
                              <div style={{ fontSize: window.innerWidth < 768 ? '0.6rem' : '0.7rem', color: '#c2410c' }}>3位</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 最終順位表 */}
                  {first && second && thirds.length >= 2 && (
                    <div style={{ marginTop: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0, color: '#1f2937' }}>🏅 最終順位</h3>
                        <button onClick={exportRankingToExcel} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem', background: '#059669', color: 'white' }}>
                          📊 Excelダウンロード
                        </button>
                      </div>
                      <table className="w-full border-collapse border border-gray-300 text-xs sm:text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-2 sm:px-4 py-1 sm:py-2 text-center w-16 sm:w-20">順位</th>
                            <th className="border border-gray-300 px-2 sm:px-4 py-1 sm:py-2 text-center">チーム名</th>
                            <th className="border border-gray-300 px-2 sm:px-4 py-1 sm:py-2 text-center">所属</th>
                            <th className="border border-gray-300 px-2 sm:px-4 py-1 sm:py-2 text-center">メンバー</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ background: '#fef9c3' }}>
                            <td className="border border-gray-300 px-2 sm:px-4 py-1 sm:py-2 text-center font-bold text-sm">🥇 優勝</td>
                            <td className="border border-gray-300 px-2 sm:px-4 py-1 sm:py-2 font-bold text-yellow-800 text-sm">{first.teamName}</td>
                            <td className="border border-gray-300 px-2 sm:px-4 py-1 sm:py-2 text-center text-sm">{first.affiliation}</td>
                            <td className="border border-gray-300 px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm">{first.members?.map(m => m.name).join('・')}</td>
                          </tr>
                          <tr style={{ background: '#f3f4f6' }}>
                            <td className="border border-gray-300 px-2 sm:px-4 py-1 sm:py-2 text-center font-bold text-sm">🥈 準優勝</td>
                            <td className="border border-gray-300 px-2 sm:px-4 py-1 sm:py-2 font-bold text-gray-700 text-sm">{second.teamName}</td>
                            <td className="border border-gray-300 px-2 sm:px-4 py-1 sm:py-2 text-center text-sm">{second.affiliation}</td>
                            <td className="border border-gray-300 px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm">{second.members?.map(m => m.name).join('・')}</td>
                          </tr>
                          {thirds.map(t => (
                            <tr key={t.teamKey} style={{ background: '#fff7ed' }}>
                              <td className="border border-gray-300 px-2 sm:px-4 py-1 sm:py-2 text-center font-bold text-sm">🥉 3位</td>
                              <td className="border border-gray-300 px-2 sm:px-4 py-1 sm:py-2 font-bold text-orange-700 text-sm">{t.teamName}</td>
                              <td className="border border-gray-300 px-2 sm:px-4 py-1 sm:py-2 text-center text-sm">{t.affiliation}</td>
                              <td className="border border-gray-300 px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm">{t.members?.map(m => m.name).join('・')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
};

export default TeamFinalsView;