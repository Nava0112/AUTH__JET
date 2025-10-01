import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';

const UsageChart = () => {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('7d'); // 7d, 30d, 90d

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.analytics.getDashboardStats();
      setStats(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const timeRanges = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' }
  ];

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num?.toString() || '0';
  };

  const calculatePercentageChange = (current, previous) => {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      isPositive: change >= 0
    };
  };

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center text-red-600">
          Failed to load usage statistics: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Usage Statistics
          </h3>
          <div className="flex space-x-2">
            {timeRanges.map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={`px-3 py-1 text-sm font-medium rounded-md ${
                  timeRange === range.value
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {/* Total Users */}
          <div className="text-center">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Total Users
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {formatNumber(stats?.total_users || 0)}
            </dd>
            {stats?.users_change && (
              <div className={`text-xs ${stats.users_change.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {stats.users_change.isPositive ? '+' : '-'}{stats.users_change.value}%
              </div>
            )}
          </div>

          {/* Active Sessions */}
          <div className="text-center">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Active Sessions
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {formatNumber(stats?.active_sessions || 0)}
            </dd>
            {stats?.sessions_change && (
              <div className={`text-xs ${stats.sessions_change.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {stats.sessions_change.isPositive ? '+' : '-'}{stats.sessions_change.value}%
              </div>
            )}
          </div>

          {/* API Requests */}
          <div className="text-center">
            <dt className="text-sm font-medium text-gray-500 truncate">
              API Requests
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {formatNumber(stats?.api_requests || 0)}
            </dd>
            {stats?.requests_change && (
              <div className={`text-xs ${stats.requests_change.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {stats.requests_change.isPositive ? '+' : '-'}{stats.requests_change.value}%
              </div>
            )}
          </div>

          {/* Success Rate */}
          <div className="text-center">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Success Rate
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {stats?.success_rate ? `${stats.success_rate}%` : '0%'}
            </dd>
            <div className="text-xs text-gray-500">
              Authentication success
            </div>
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
          <div className="text-center">
            <div className="text-sm text-gray-500">Webhook Calls</div>
            <div className="text-2xl font-semibold text-gray-900">
              {formatNumber(stats?.webhook_calls || 0)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500">Failed Logins</div>
            <div className="text-2xl font-semibold text-gray-900">
              {formatNumber(stats?.failed_logins || 0)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500">New Clients</div>
            <div className="text-2xl font-semibold text-gray-900">
              {formatNumber(stats?.new_clients || 0)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500">Uptime</div>
            <div className="text-2xl font-semibold text-gray-900">
              {stats?.uptime ? `${stats.uptime}%` : '100%'}
            </div>
          </div>
        </div>

        {/* Simple Bar Chart for Requests */}
        {stats?.daily_requests && stats.daily_requests.length > 0 && (
          <div className="mt-8">
            <h4 className="text-sm font-medium text-gray-900 mb-4">Daily API Requests</h4>
            <div className="flex items-end space-x-1 h-32">
              {stats.daily_requests.slice(-14).map((day, index) => {
                const maxRequests = Math.max(...stats.daily_requests.map(d => d.requests));
                const height = maxRequests > 0 ? (day.requests / maxRequests) * 80 : 0;
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-indigo-500 rounded-t transition-all duration-300"
                      style={{ height: `${height}%` }}
                    ></div>
                    <div className="text-xs text-gray-500 mt-1 truncate">
                      {new Date(day.date).getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsageChart;