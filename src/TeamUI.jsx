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
    
    // Listen for database changes instantly without page reloads
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
      // 🔒 Anti-Reshuffle Logic
      const newInitials = { ...initialLounges };
      let changed = false;
      data.forEach(g => {
        if (!newInitials[g.id]) {
          newInitials[g.id] = g.lounge || 'L1';
          changed = true;
        }
      });
      if (changed) setInitialLounges(newInitials);

      // Custom Sorting: Room priority -> Arrival Time
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
    <div className="space-y-4">
      <h2 className="text-xl font-bold">📍 Active Guests</h2>
      <input type="text" placeholder="🔍 Search Guest Name..." className="w-full border p-3 rounded-lg shadow-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
      
      {filteredGuests.length === 0 ? (
        <div className="p-6 text-center bg-green-50 text-green-700 rounded-lg border border-green-200 font-medium">No active guests currently waiting. Take a breather! ☕</div>
      ) : (
        filteredGuests.map(guest => <GuestCard key={guest.id} guest={guest} fetchGuests={fetchActiveGuests} />)
      )}
    </div>
  );
}

// Independent component to handle Local State -> Save Button paradigm
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

  const handleUpdate = (field, value) => {
    setLocalData(prev => ({ ...prev, [field]: value }));
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
    alert('✅ Photo saved!');
    setTempPhoto(null);
    fetchGuests();
  };

  const saveUpdates = async () => {
    await supabase.from('guests').update(localData).eq('id', guest.id);
    alert(`✅ Saved updates for ${guest.guest_name}!`);
  };

  const markComplete = async () => {
    await supabase.from('guests').update({ jai_gurudev: true }).eq('id', guest.id);
    // Realtime listener in parent will auto-remove them
  };

  const getWhatsAppUrl = () => {
    const msg = `*${localData.lounge}*\n${guest.guest_name}\n📺 LMW: ${localData.lmw_status}\n💻 IP Demo: ${localData.demo_status}\n⏳ Ready for Vyas: ${localData.ready_to_meet_gurudev ? '✅' : '❌'}\n🤝 Met Gurudev: ${localData.met_gurudev ? '✅' : '❌'}`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div style={{ backgroundColor: colors.bg, color: colors.text }} className="p-3 text-center font-bold text-lg transition-colors">
        👤 {guest.guest_name}
      </div>

      <div className="p-4 space-y-4">
        {/* Lounge & Photo */}
        <div className="flex gap-2">
          <select 
            className="flex-1 bg-gray-50 border p-2 rounded-lg font-medium"
            value={localData.lounge}
            onChange={(e) => handleUpdate('lounge', e.target.value)}
          >
            {['L1', 'L2', 'L3', 'BR', 'L5'].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          
          <button onClick={() => setShowPhoto(!showPhoto)} className="bg-gray-100 border px-4 rounded-lg text-xl hover:bg-gray-200">📸</button>
        </div>

        {showPhoto && (
          <div className="bg-gray-50 p-3 rounded-lg border space-y-3">
            {(tempPhoto || guest.photo_data) ? (
              <img src={`data:image/jpeg;base64,${tempPhoto || guest.photo_data}`} alt="Guest" className="w-full rounded-lg shadow-sm border" />
            ) : (
              <p className="text-sm text-gray-500 text-center">No photo captured.</p>
            )}
            <input type="file" accept="image/*" capture="environment" className="w-full text-sm" onChange={handlePhotoCapture} />
            {tempPhoto && <button onClick={savePhoto} className="w-full bg-blue-600 text-white py-2 rounded-md font-bold">💾 Save Photo</button>}
          </div>
        )}

        {/* 3-State Segmented Controls */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 font-bold mb-1">📺 LMW</p>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              {['Not yet', 'Started', 'Done'].map(status => (
                <button key={status} onClick={() => handleUpdate('lmw_status', status)} className={`flex-1 text-xs py-2 rounded-md font-medium transition-all ${localData.lmw_status === status ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>{status}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold mb-1">💻 IP Demo</p>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              {['Not yet', 'Started', 'Done'].map(status => (
                <button key={status} onClick={() => handleUpdate('demo_status', status)} className={`flex-1 text-xs py-2 rounded-md font-medium transition-all ${localData.demo_status === status ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>{status}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Binary Toggles */}
        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border cursor-pointer select-none">
            <input type="checkbox" checked={localData.ready_to_meet_gurudev} onChange={(e) => handleUpdate('ready_to_meet_gurudev', e.target.checked)} className="w-5 h-5 text-blue-600 rounded" />
            <span className="text-sm font-bold">⏳ Ready for Vyas</span>
          </label>
          <label className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border cursor-pointer select-none">
            <input type="checkbox" checked={localData.met_gurudev} onChange={(e) => handleUpdate('met_gurudev', e.target.checked)} className="w-5 h-5 text-blue-600 rounded" />
            <span className="text-sm font-bold">🤝 Met Gurudev</span>
          </label>
        </div>

        {/* Action Buttons (Matches Streamlit 3-button layout) */}
        <div className="flex gap-2 pt-2 border-t">
          <a href={getWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="flex-[0.8] bg-green-50 text-green-700 border border-green-200 text-center text-sm font-bold py-3 rounded-lg shadow-sm leading-tight flex items-center justify-center">
            📲 WhatsApp
          </a>
          <button onClick={saveUpdates} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-bold py-3 rounded-lg shadow-sm leading-tight flex items-center justify-center">
            💾 Save Updates
          </button>
          <button onClick={markComplete} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-3 rounded-lg shadow-sm leading-tight flex items-center justify-center">
            ✅ Complete
          </button>
        </div>
      </div>
    </div>
  );
}