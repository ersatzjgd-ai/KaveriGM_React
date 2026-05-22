import { useState, useEffect } from 'react';
import { supabase } from './supabase';

const colorMap = {
  "L1": { bg: "#00FFFF", text: "#000000" },
  "L2": { bg: "#FFFF00", text: "#000000" },
  "L3": { bg: "#FF00FF", text: "#FFFFFF" },
  "L5": { bg: "#000000", text: "#FFFFFF" },
  "BR": { bg: "#E0E0E0", text: "#000000" }
};
const roomOrder = { "L1": 1, "L2": 2, "L3": 3, "BR": 4, "L5": 5 };

export default function TeamUI() {
  const [activeGuests, setActiveGuests] = useState([]);
  const [search, setSearch] = useState('');
  const [initialLounges, setInitialLounges] = useState({});

  useEffect(() => {
    fetchActiveGuests();
    
    const channel = supabase.channel('public:guests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, fetchActiveGuests)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const fetchActiveGuests = async () => {
    const today = new Date().toISOString().split('T')[0] + 'T00:00:00';
    const { data } = await supabase
      .from('guests')
      .select('*')
      .gte('created_at', today)
      .eq('is_active', true)
      .eq('jai_gurudev', false);
    
    if (data) {
      const newInitials = { ...initialLounges };
      let changed = false;
      data.forEach(g => {
        if (!newInitials[g.id]) {
          newInitials[g.id] = g.lounge || 'L1';
          changed = true;
        }
      });
      if (changed) setInitialLounges(newInitials);

      const sorted = data.sort((a, b) => {
        const roomA = roomOrder[newInitials[a.id]] || 99;
        const roomB = roomOrder[newInitials[b.id]] || 99;
        if (roomA !== roomB) return roomA - roomB;
        return new Date(a.created_at) - new Date(b.created_at);
      });
      
      setActiveGuests(sorted);
    }
  };

  const filteredGuests = activeGuests.filter(g => g.guest_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">📍 Active Guests</h2>
      <input type="text" placeholder="🔍 Search Guest Name..." className="w-full border-2 p-3 rounded-lg shadow-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
      
      {filteredGuests.length === 0 ? (
        <div className="p-6 text-center bg-green-50 text-green-700 rounded-lg border-2 border-green-200 font-medium shadow-sm">No active guests currently waiting. Take a breather! ☕</div>
      ) : (
        filteredGuests.map(guest => <GuestCard key={guest.id} guest={guest} fetchGuests={fetchActiveGuests} />)
      )}
    </div>
  );
}

function GuestCard({ guest, fetchGuests }) {
  const [localData, setLocalData] = useState({
    lounge: guest.lounge || 'L1',
    lmw_status: guest.lmw_status || 'Not yet',
    demo_status: guest.demo_status || 'Not yet',
    ready_to_meet_gurudev: guest.ready_to_meet_gurudev || false,
    met_gurudev: guest.met_gurudev || false,
  });
  
  const [showPhoto, setShowPhoto] = useState(false);
  const [tempPhoto, setTempPhoto] = useState(null);

  const colors = colorMap[localData.lounge] || colorMap["BR"];

  const handleUpdate = async (field, value) => {
    setLocalData(prev => ({ ...prev, [field]: value }));
    await supabase.from('guests').update({ [field]: value }).eq('id', guest.id);
  };

  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setTempPhoto(reader.result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  };

  const savePhoto = async () => {
    if (!tempPhoto) return;
    await supabase.from('guests').update({ photo_data: tempPhoto }).eq('id', guest.id);
    setTempPhoto(null);
    fetchGuests();
  };

  const markComplete = async () => {
    await supabase.from('guests').update({ jai_gurudev: true }).eq('id', guest.id);
  };

  const getWhatsAppUrl = () => {
    const msg = `*${localData.lounge}*\n${guest.guest_name}\n📺 LMW: ${localData.lmw_status}\n💻 IP Demo: ${localData.demo_status}\n⏳ Ready: ${localData.ready_to_meet_gurudev ? '✅' : '❌'}\n🤝 Met Gurudev: ${localData.met_gurudev ? '✅' : '❌'}`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 overflow-hidden mb-6">
      <div style={{ backgroundColor: colors.bg, color: colors.text }} className="p-3 text-center font-bold text-lg transition-colors border-b-2 border-gray-200">
        👤 {guest.guest_name}
      </div>

      <div className="p-4 space-y-5">
        <div className="flex gap-2">
          <select 
            className="flex-1 bg-gray-50 border-2 border-gray-200 p-2 rounded-lg font-bold"
            value={localData.lounge}
            onChange={(e) => handleUpdate('lounge', e.target.value)}
          >
            {['L1', 'L2', 'L3', 'BR', 'L5'].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          
          <button onClick={() => setShowPhoto(!showPhoto)} className="bg-gray-100 border-2 border-gray-200 px-4 rounded-lg text-xl hover:bg-gray-200 transition-colors">📸</button>
        </div>

        {showPhoto && (
          <div className="bg-gray-50 p-3 rounded-lg border-2 border-gray-200 space-y-3">
            {(tempPhoto || guest.photo_data) ? (
              <img src={`data:image/jpeg;base64,${tempPhoto || guest.photo_data}`} alt="Guest" className="w-full rounded-lg shadow-sm border" />
            ) : (
              <p className="text-sm text-gray-500 text-center font-medium">No photo captured.</p>
            )}
            <input type="file" accept="image/*" capture="environment" className="w-full text-sm font-medium" onChange={handlePhotoCapture} />
            {tempPhoto && <button onClick={savePhoto} className="w-full bg-blue-600 text-white py-2 rounded-md font-bold">💾 Save Photo</button>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 font-bold mb-1 uppercase tracking-wide">📺 LMW</p>
            <div className="flex bg-gray-100 p-1 rounded-lg border-2 border-gray-200">
              {['Not yet', 'Started', 'Done'].map(status => (
                <button 
                  key={status} 
                  onClick={() => handleUpdate('lmw_status', status)} 
                  className={`flex-1 text-xs py-2 rounded-md font-bold transition-all ${
                    localData.lmw_status === status 
                      ? 'bg-blue-600 text-white shadow-md transform scale-105' 
                      : 'text-gray-500 hover:bg-gray-200' 
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold mb-1 uppercase tracking-wide">💻 IP Demo</p>
            <div className="flex bg-gray-100 p-1 rounded-lg border-2 border-gray-200">
              {['Not yet', 'Started', 'Done'].map(status => (
                <button 
                  key={status} 
                  onClick={() => handleUpdate('demo_status', status)} 
                  className={`flex-1 text-xs py-2 rounded-md font-bold transition-all ${
                    localData.demo_status === status 
                      ? 'bg-blue-600 text-white shadow-md transform scale-105' 
                      : 'text-gray-500 hover:bg-gray-200' 
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer select-none transition-all ${localData.ready_to_meet_gurudev ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
            <input type="checkbox" checked={localData.ready_to_meet_gurudev} onChange={(e) => handleUpdate('ready_to_meet_gurudev', e.target.checked)} className="w-5 h-5 text-blue-600 rounded" />
            <span className="text-sm font-bold">⏳ Ready</span>
          </label>
          <label className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer select-none transition-all ${localData.met_gurudev ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
            <input type="checkbox" checked={localData.met_gurudev} onChange={(e) => handleUpdate('met_gurudev', e.target.checked)} className="w-5 h-5 text-blue-600 rounded" />
            <span className="text-sm font-bold">🤝 Met Gurudev</span>
          </label>
        </div>

        <div className="flex gap-3 pt-4 border-t-2 border-gray-100">
          <a href={getWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="flex-1 bg-green-50 text-green-700 border-2 border-green-200 hover:bg-green-100 text-center text-sm font-bold py-3 rounded-lg shadow-sm transition-colors flex items-center justify-center">
            📲 WhatsApp
          </a>
          <button onClick={markComplete} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-3 rounded-lg shadow-sm transition-colors flex items-center justify-center">
            ✅ Complete
          </button>
        </div>
      </div>
    </div>
  );
}
}
