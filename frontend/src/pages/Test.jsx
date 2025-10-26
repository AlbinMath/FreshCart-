import React from 'react';

function Test() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center">
        <h1 className="text-3xl font-bold text-green-600 mb-4">✅ FreshCart is Working!</h1>
        <p className="text-gray-600 mb-4">Your React + Vite + Tailwind setup is working correctly.</p>
        <div className="space-y-2">
          <div className="text-sm text-gray-500">✅ React Components</div>
          <div className="text-sm text-gray-500">✅ Tailwind CSS</div>
          <div className="text-sm text-gray-500">✅ Vite Build System</div>
          <div className="text-sm text-gray-500">✅ Routing System</div>
        </div>
      </div>
    </div>
  );
}

export default Test;


