import React, { useState, useEffect, useMemo } from 'react';
import { applicantsApi } from '../utils/api';

const StatsView = ({ state, selectedTournamentId }) => {
  const [archers, setArchers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchArchers = async () => {
      if (!selectedTournamentId) {
        setArchers([]);
        return;
      }
      setIsLoading(true);
      try {
        const result = await applicantsApi.getByTournament(selectedTournamentId);
        if (result.success) {
          setArchers(result.data || []);
        } else {
          setArchers([]);
        }
      } catch (error) {
        console.error('Failed to fetch archers:', error);
        setArchers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchArchers();
  }, [selectedTournamentId]);

  const affiliationStats = useMemo(() => {
    const stats = {};
    archers.forEach(archer => {
      const affiliation = archer.affiliation || '未設定';
      if (!stats[affiliation]) {
        stats[affiliation] = { total: 0 };
      }
      stats[affiliation].total++;
    });

    return Object.entries(stats)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [archers]);

  const tournament = state.registeredTournaments?.find(t => t.id === selectedTournamentId);
  const participationFee = Number(tournament?.data?.participationFee) || 0;
  const totalFee = participationFee * archers.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="view-container">
      <div className="view-content">
        <div className="card">
          <h2 className="card-title mb-4">📊 支部別参加者集計</h2>
          <p className="text-sm text-gray-600 mb-4">
            大会名: {tournament?.data?.name || selectedTournamentId}
          </p>

          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-600 mb-1">総申込者数</div>
              <div className="text-3xl font-bold text-blue-900">{archers.length}名</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="text-sm text-purple-600 mb-1">支部数</div>
              <div className="text-3xl font-bold text-purple-900">{affiliationStats.length}</div>
            </div>
          </div>

          {participationFee > 0 && (
            <div className="mb-6 bg-green-50 p-4 rounded-lg border-2 border-green-300">
              <div className="text-sm text-green-600 mb-1">💰 参加費合計</div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-bold text-green-900">{totalFee.toLocaleString()}円</div>
                <div className="text-sm text-green-700">(一人 {participationFee.toLocaleString()}円 × {archers.length}名)</div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left">順位</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">支部名</th>
                  <th className="border border-gray-300 px-4 py-2 text-center">申込人数</th>
                  {participationFee > 0 && (
                    <th className="border border-gray-300 px-4 py-2 text-center">参加費合計</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {affiliationStats.length === 0 ? (
                  <tr>
                    <td colSpan={participationFee > 0 ? "4" : "3"} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                      参加者がいません
                    </td>
                  </tr>
                ) : (
                  affiliationStats.map((stat, index) => (
                    <tr key={stat.name} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2 text-center font-semibold">
                        {index + 1}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 font-semibold">
                        {stat.name}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center font-bold text-blue-900">
                        {stat.total}名
                      </td>
                      {participationFee > 0 && (
                        <td className="border border-gray-300 px-4 py-2 text-center font-bold text-green-900">
                          {(participationFee * stat.total).toLocaleString()}円
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsView;
