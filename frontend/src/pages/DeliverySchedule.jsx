import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, addDoc, deleteDoc, doc, getDocs, query, orderBy, serverTimestamp } from "firebase/firestore";
import DeliveryVerificationGuard from "../components/DeliveryVerificationGuard";

// Delivery schedule: date-based entries the partner can add/remove on their own
export default function DeliverySchedule() {
  const { currentUser, getUserProfile } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]); // list of {id, date, start, end?, durationMinutes?, note}

  // Default start time = now + 6 hours
  const defaultStart = useMemo(() => {
    const d = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const date = d.toISOString().slice(0, 10); // yyyy-mm-dd
    const start = d.toTimeString().slice(0, 5); // HH:MM
    return { date, start };
  }, []);

  const [form, setForm] = useState({
    date: defaultStart.date,
    start: defaultStart.start,
    durationMinutes: 60,
    end: "",
    useDuration: true,
    note: ""
  });
  const [msg, setMsg] = useState("");
  // Duration options (easy to customize later)
  const durations = useMemo(() => [30, 45, 60, 90, 120, 180, 240], []);
  // Track current time for live locking/counter updates
  const [nowTs, setNowTs] = useState(Date.now());

  useEffect(() => {
    if (!currentUser) return;
    const p = getUserProfile();
    if (p?.role !== 'delivery') return;
    load();
  }, [currentUser]);

  // Tick every minute to update lock state/countdown
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    try {
      const q = query(
        collection(db, `users/${currentUser.uid}/schedules`),
        orderBy("date", "asc"),
        orderBy("start", "asc")
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(rows);
    } catch {}
  }

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  // Build a Date in local time from yyyy-mm-dd and HH:MM safely
  function buildLocalDateTime(dateStr, timeStr) {
    const [y, m, d] = (dateStr || '').split('-').map(Number);
    const [hh, mm] = (timeStr || '').split(':').map(Number);
    if (!y || !m || !d || isNaN(hh) || isNaN(mm)) return new Date('');
    return new Date(y, m - 1, d, hh, mm, 0, 0); // local
  }

  // Validate: must be at least 6 hours from now; not in the past
  function validateSchedule() {
    if (!form.date || !form.start) return 'Date and Start required';
    const scheduled = buildLocalDateTime(form.date, form.start);
    if (isNaN(scheduled.getTime())) return 'Invalid date/time';
    const minAllowed = new Date(Date.now() + 6 * 60 * 60 * 1000);
    if (scheduled < minAllowed) return 'Must be at least 6 hours from now';
    // If using end time, ensure end > start
    if (!form.useDuration && form.end) {
      const end = buildLocalDateTime(form.date, form.end);
      if (isNaN(end.getTime()) || end <= scheduled) return 'End time must be after start time';
    }
    return '';
  }

  // Is a schedule locked from changes (within 6 hours of start)?
  function isLocked(it) {
    const scheduled = new Date(`${it.date}T${it.start}:00`).getTime();
    return scheduled - nowTs < 6 * 60 * 60 * 1000; // less than 6 hours remaining
  }

  // Human-friendly remaining time (for tooltip/label)
  function remainingLabel(it) {
    const ms = new Date(`${it.date}T${it.start}:00`).getTime() - nowTs;
    if (ms <= 0) return 'started';
    const mins = Math.ceil(ms / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  const add = async (e) => {
    e.preventDefault();
    setMsg("");
    const validation = validateSchedule();
    if (validation) { setMsg(validation); return; }
    try {
      const body = form.useDuration
        ? { date: form.date, start: form.start, durationMinutes: Number(form.durationMinutes), note: form.note }
        : { date: form.date, start: form.start, end: form.end, note: form.note };
      await addDoc(collection(db, `users/${currentUser.uid}/schedules`), {
        ...body,
        createdAt: serverTimestamp()
      });
      await load();
      setForm({ date: defaultStart.date, start: defaultStart.start, durationMinutes: 60, end: "", useDuration: true, note: "" });
      setMsg('Schedule added successfully');
    } catch (e1) { setMsg(e1.message || 'Failed'); }
  };

  const removeAt = async (idxOrId) => {
    try {
      const it = typeof idxOrId === 'string' ? items.find(x => x.id === idxOrId) : items[idxOrId];
      if (it && isLocked(it)) { setMsg('Cannot modify within 6 hours of start'); return; }
      const id = typeof idxOrId === 'string' ? idxOrId : it?.id;
      if (!id) { setMsg('Invalid item'); return; }
      await deleteDoc(doc(db, `users/${currentUser.uid}/schedules/${id}`));
      await load();
      setMsg('Schedule removed');
    } catch (e1) { setMsg(e1.message || 'Failed'); }
  };

  return (
    <DeliveryVerificationGuard>
      <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Delivery Schedule</h1>
          <button onClick={() => navigate('/delivery')} className="px-3 py-2 border rounded-lg text-sm">Back to Dashboard</button>
        </div>

        {/* Add form */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Add New Schedule</h2>
          <form onSubmit={add} className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Date</label>
              <input type="date" name="date" value={form.date} onChange={onChange} className="w-full p-3 border rounded-lg" min={new Date().toISOString().slice(0,10)} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Start Time</label>
              <input type="time" name="start" value={form.start} onChange={onChange} className="w-full p-3 border rounded-lg" />
              {/* Optional: show hint for earliest allowed time if date is today */}
              {form.date === new Date().toISOString().slice(0,10) && (
                <p className="text-xs text-gray-500 mt-1">Earliest allowed start: {new Date(Date.now() + 6*60*60*1000).toTimeString().slice(0,5)}</p>
              )}
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <input id="useDuration" type="checkbox" name="useDuration" checked={form.useDuration} onChange={onChange} />
              <label htmlFor="useDuration" className="text-sm text-gray-700">Use duration instead of end time</label>
            </div>
            {form.useDuration ? (
              <div>
                <label className="block text-sm text-gray-700 mb-1">Duration (minutes)</label>
                <select name="durationMinutes" value={form.durationMinutes} onChange={onChange} className="w-full p-3 border rounded-lg">
                  {durations.map((d) => <option key={d} value={d}>{d} minutes</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text sm text-gray-700 mb-1">End Time</label>
                <input type="time" name="end" value={form.end} onChange={onChange} className="w-full p-3 border rounded-lg" />
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 mb-1">Note (optional)</label>
              <input name="note" value={form.note} onChange={onChange} placeholder="e.g., Morning run" className="w-full p-3 border rounded-lg" />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className="px-4 py-2 rounded-lg bg-green-600 text-white">Add Schedule</button>
            </div>
          </form>
          {msg && <p className="mt-2 text-sm text-gray-600">{msg}</p>}
          <p className="mt-1 text-xs text-gray-500">You cannot schedule in the past. Once within 6 hours of start, the schedule is locked from changes.</p>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl shadow divide-y">
          {items.length === 0 && <div className="p-4 text-sm text-gray-500">No schedules yet.</div>}
          {items.map((it) => {
            const locked = isLocked(it);
            return (
              <div key={it.id || `${it.date}-${it.start}`} className="p-4 flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {it.date} at {it.start}
                    {it.end ? ` - ${it.end}` : it.durationMinutes ? ` (${it.durationMinutes} mins)` : ''}
                  </div>
                  <div className="text-xs text-gray-500">
                    {locked ? `Locked (starts in ${remainingLabel(it)})` : `Editable (starts in ${remainingLabel(it)})`}
                  </div>
                  {it.note && <div className="text-xs text-gray-600">{it.note}</div>}
                </div>
                <button
                  onClick={() => removeAt(it.id)}
                  disabled={locked}
                  title={locked ? 'Cannot modify within 6 hours of start' : 'Remove schedule'}
                  className={`px-3 py-1 border rounded text-sm ${locked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </DeliveryVerificationGuard>
  );
}