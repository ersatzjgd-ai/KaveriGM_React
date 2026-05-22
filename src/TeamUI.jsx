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
    <div className="space-y-6"> {/* Increased spacing to separate guest boxes clearly */}
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

// Independent component to handle instantly responsive Local State -> Auto Save
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

  // AUTO-SAVE HANDLER: Updates screen instantly, saves to DB silently
  const handleUpdate = async (field, value) => {
    // 1. Instantly update the UI so it feels lightning fast
    setLocalData(prev => ({ ...prev, [field]: value }));
    
    // 2. Silently update the database in the background
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
    // Realtime listener in parent will auto-remove them
  };

  const getWhatsAppUrl = () => {
    const msg = `*${localData.lounge}*\n${guest.guest_name}\n📺 LMW: ${localData.lmw_status}\n💻 IP Demo: ${localData.demo_status}\n⏳ Ready: ${localData.ready_to_meet_gurudev ? '✅' : '❌'}\n🤝 Met Gurudev: ${localData.met_gurudev ? '✅' : '❌'}`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  // Enhanced Box Styling: Deep shadow, thicker border
  return (
    <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 overflow-hidden mb-6">
      <div style={{ backgroundColor: colors.bg, color: colors.text }} className="p-3 text-center font-bold text-lg transition-colors border-b-2 border-gray-200">
        👤 {guest.guest_name}
      </div>

      <div className="p-4 space-y-5">
        {/* Lounge & Photo */}
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
