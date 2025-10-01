import React from 'react';

const StatsCard = ({ title, value, change, changeType = 'neutral', icon, description }) => {
  const changeColors = {
    positive: 'text-green-600',
    negative: 'text-red-600',
    neutral: 'text-gray-600'
  };

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {icon}
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className="text-lg font-medium text-gray-900">
                {value}
              </dd>
              {change && (
                <dd className={`text-sm ${changeColors[changeType]}`}>
                  {change}
                </dd>
              )}
            </dl>
          </div>
        </div>
      </div>
      {description && (
        <div className="bg-gray-50 px-5 py-3">
          <div className="text-sm">
            <span className="text-gray-600">{description}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsCard;