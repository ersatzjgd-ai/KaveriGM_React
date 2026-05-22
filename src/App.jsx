import { useState } from 'react';
import ManagerUI from './ManagerUI';
import TeamUI from './TeamUI';

export default function App() {
  const [role, setRole] = useState('team'); 

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-20">
      <header className="bg-white shadow-sm sticky top-0 z-50 p-4">
        <h1 className="text-2xl font-bold text-center">🏛️ Kaveri GM</h1>
        
        <div className="flex bg-gray-200 rounded-lg p-1 mt-4 max-w-sm mx-auto">
          <button 
            className={`flex-1 py-2 rounded-md font-medium text-sm transition-all ${role === 'team' ? 'bg-white shadow' : 'text-gray-500'}`}
            onClick={() => setRole('team')}
          >
            On-Ground Team 🏃
          </button>
          <button 
            className={`flex-1 py-2 rounded-md font-medium text-sm transition-all ${role === 'manager' ? 'bg-white shadow' : 'text-gray-500'}`}
            onClick={() => setRole('manager')}
          >
            Manager 👔
          </button>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto">
        {role === 'manager' ? <ManagerUI /> : <TeamUI />}
      </main>
    </div>
  );
}
