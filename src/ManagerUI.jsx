import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { jsPDF } from 'jspdf';

export default function ManagerUI() {
  const [loggedIn, setLoggedIn] = useState(sessionStorage.getItem('mgr_logged_in') === 'true');
  const [password, setPassword] = useState('');
  const [guests, setGuests] = useState([]);
  const [search, setSearch] = useState('');
  const [newGuestNames, setNewGuestNames] = useState('');
  const [sessionType, setSessionType] = useState('Morning');

  useEffect(() => {
    if (loggedIn) fetchGuests();
  }, [loggedIn]);

  const fetchGuests = async () => {
    const today = new Date().toISOString().split('T')[0] + 'T00:00:00';
    const { data } = await supabase
      .from('guests')
      .select('*')
      .gte('created_at', today)
      .order('created_at', { ascending: true });
    if (data) setGuests(data);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'kaveri_admin') { 
      setLoggedIn(true);
      sessionStorage.setItem('mgr_logged_in', 'true');
    } else {
      alert('Incorrect Password');
    }
  };

  const handlePhotoCapture = (e, guestId) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result.split(',')[1];
      setGuests(guests.map(g => g.id === guestId ? { ...g, tempPhoto: base64String } : g));
    };
    reader.readAsDataURL(file);
  };

  const assignLounge = async (guest, lounge) => {
    const updateData = { is_active: true, lounge };
    if (guest.tempPhoto) updateData.photo_data = guest.tempPhoto;

    await supabase.from('guests').update(updateData).eq('id', guest.id);
    alert(`${guest.guest_name} sent to ${lounge}!`);
    fetchGuests();
  };

  const undoArrival = async (id) => {
    await supabase.from('guests').update({ is_active: false }).eq('id', id);
    fetchGuests();
  };

  const addExpectedGuests = async (e) => {
    e.preventDefault();
    const names = newGuestNames.split('\n').map(n => n.trim()).filter(n => n);
    if (!names.length) return;
    
    const insertData = names.map(name => ({ guest_name: name, session_type: sessionType }));
    await supabase.from('guests').insert(insertData);
    setNewGuestNames('');
    fetchGuests();
    alert(`Added ${names.length} guests!`);
  };

  const generatePDF = () => {
    const reportGuests = guests.filter(g => !g.has_left_kaveri); // Today's active/completed guests
    const doc = new jsPDF();
    let y = 15;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Kaveri GM - End of Session Report (${new Date().toLocaleDateString()})`, 105, y, { align: 'center' });
    y += 15;

    reportGuests.forEach((g) => {
      if (y > 270) { doc.addPage(); y = 15; }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Guest: ${g.guest_name} (${g.session_type || 'N/A'})`, 15, y);
      y += 7;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Lounge: ${g.lounge || 'Not Assigned'}`, 15, y);
      y += 6;
      doc.text(`LMW: ${g.lmw_status || 'Not yet'} | IP Demo: ${g.demo_status || 'Not yet'}`, 15, y);
      y += 6;
      doc.text(`Met Gurudev: ${g.met_gurudev ? 'Yes' : 'No'} | Visit Complete: ${g.jai_gurudev ? 'Yes' : 'No'}`, 15, y);
      y += 5;

      if (g.photo_data) {
        try {
          doc.addImage(`data:image/jpeg;base64,${g.photo_data}`, 'JPEG', 15, y, 25, 25);
          y += 30;
        } catch (e) {
          doc.text("[Error loading photo]", 15, y);
          y += 10;
        }
      } else {
        y += 5;
      }

      doc.line(15, y, 195, y);
      y += 10;
    });

    doc.save(`Kaveri_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (!loggedIn) {
    return (
      <form onSubmit={handleLogin} className="bg-white p-6 rounded-lg shadow-sm border text-center">
        <h2 className="text-xl font-bold mb-4">🔒 Manager Access</h2>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin Password" className="w-full border p-2 rounded mb-4" />
        <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded">Login</button>
      </form>
    );
  }

  const expectedGuests = guests.filter(g => !g.is_active && !g.has_left_kaveri);
  const activeGuests = guests.filter(g => g.is_active && !g.jai_gurudev);
  const filteredExpected = expectedGuests.filter(g => g.guest_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <button onClick={() => { setLoggedIn(false); sessionStorage.removeItem('mgr_logged_in'); }} className="text-red-500 font-medium float-right">Logout</button>
      
      {/* EXPECTED GUESTS */}
      <section>
        <h2 className="text-xl font-bold border-b pb-2 mb-4">📥 Incoming Guests</h2>
        <p className="text-sm text-gray-500 mb-2">Capture a photo, then tap a lounge pill to check-in.</p>
        <input type="text" placeholder="🔍 Search Expected Guest..." className="w-full border p-2 rounded mb-4" value={search} onChange={(e) => setSearch(e.target.value)} />
        
        <div className="space-y-4">
          {filteredExpected.map(guest => (
            <div key={guest.id} className="bg-white p-4 rounded-lg shadow-sm border">
              <p className="font-bold mb-2">👤 {guest.guest_name} <span className="text-sm font-normal text-gray-500">({guest.session_type})</span></p>
              
              <details className="mb-3 group cursor-pointer">
                <summary className="text-sm font-medium text-gray-700 bg-gray-100 p-2 rounded list-none text-center">
                  {guest.tempPhoto ? '✅ Photo Ready' : '📸 Capture Photo (Optional)'}
                </summary>
                <div className="pt-2">
                  <input type="file" accept="image/*" capture="environment" className="w-full text-sm" onChange={(e) => handlePhotoCapture(e, guest.id)} />
                </div>
              </details>

              <div className="flex justify-between gap-1">
                {['L1', 'L2', 'L3', 'BR', 'L5'].map(l => (
                  <button key={l} onClick={() => assignLounge(guest, l)} className="flex-1 bg-gray-200 hover:bg-blue-100 py-2 rounded-full font-medium text-sm transition-colors">{l}</button>
                ))}
              </div>
            </div>
          ))}
          {filteredExpected.length === 0 && <p className="text-gray-500 text-center">No expected guests.</p>}
        </div>
      </section>

      {/* ACTIVE GUESTS */}
      <section>
        <h2 className="text-xl font-bold border-b pb-2 mb-4">🟢 Arrived Guests</h2>
        <div className="space-y-2">
          {activeGuests.map(ag => (
            <div key={ag.id} className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border">
              <p className="font-medium">{ag.guest_name} <span className="text-gray-500 ml-2">| {ag.lounge}</span></p>
              <button onClick={() => undoArrival(ag.id)} className="bg-gray-100 text-gray-800 text-xs px-3 py-1.5 rounded font-bold hover:bg-red-50 hover:text-red-600 transition-colors">↩️ Undo</button>
            </div>
          ))}
        </div>
      </section>

      {/* ADD GUESTS */}
      <details className="bg-white p-4 rounded-lg shadow-sm border group cursor-pointer">
        <summary className="font-bold list-none">➕ Add New Expected Guests</summary>
        <form onSubmit={addExpectedGuests} className="pt-4">
          <div className="flex gap-4 mb-3">
            <label><input type="radio" checked={sessionType === 'Morning'} onChange={() => setSessionType('Morning')} /> Morning</label>
            <label><input type="radio" checked={sessionType === 'Evening'} onChange={() => setSessionType('Evening')} /> Evening</label>
          </div>
          <textarea value={newGuestNames} onChange={(e) => setNewGuestNames(e.target.value)} placeholder="One name per line" className="w-full border p-2 rounded mb-3 h-24" />
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded">💾 Save to Database</button>
        </form>
      </details>

      {/* PDF REPORT */}
      <details className="bg-white p-4 rounded-lg shadow-sm border group cursor-pointer mb-8">
        <summary className="font-bold list-none">📊 View End of Session Report</summary>
        <div className="pt-4">
          <p className="text-sm text-gray-600 mb-4">Generate and download a complete PDF report of today's session.</p>
          <button onClick={generatePDF} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
            <span>📥</span> Download Report as PDF
          </button>
        </div>
      </details>
    </div>
  );
}