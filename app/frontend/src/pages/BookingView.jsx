import React, { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Clock, Loader2, CheckCircle2, ShieldAlert } from "lucide-react";
import { api, userStore } from "@/lib/api";
import toast from "react-hot-toast";

import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

const BookingView = () => {
  const [assets, setAssets] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState("");
  
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [loading, setLoading] = useState(false);
  const username = userStore.getUsername();

  const fetchData = async () => {
    try {
      const [aRes, bRes] = await Promise.all([
        api.get("/assets"),
        api.get("/bookings")
      ]);
      setAssets(aRes.data);
      setBookings(bRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAsset || !startTime || !endTime) return toast.error("Please fill all fields");
    setLoading(true);
    try {
      await api.post("/bookings", {
        id: "book_" + Date.now(),
        asset_id: selectedAsset,
        booked_by: username || "employee",
        start_time: startTime,
        end_time: endTime,
        status: "Upcoming"
      });
      toast.success("Booking confirmed!");
      setStartTime("");
      setEndTime("");
      fetchData();
    } catch (e) {
      if (e.response && e.response.status === 409) {
        toast.error("Conflict: Overlapping booking detected!");
      } else {
        toast.error("Failed to create booking");
      }
    } finally {
      setLoading(false);
    }
  };

  // Convert bookings to events for the calendar
  const events = bookings
    .filter(b => selectedAsset === "" || b.asset_id === selectedAsset)
    .map(b => ({
      id: b.id,
      title: `${b.asset_id} booked by ${b.booked_by}`,
      start: new Date(b.start_time),
      end: new Date(b.end_time),
      status: b.status
    }));

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Resource Booking</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Booking Form */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm h-fit">
          <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Reserve Resource</h2>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Asset / Resource</label>
              <select 
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">-- All Resources --</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                ))}
              </select>
            </div>
            
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input 
                  type="datetime-local" 
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 bg-white text-gray-900" 
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input 
                  type="datetime-local" 
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 bg-white text-gray-900" 
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-center gap-2 text-blue-800 text-xs">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>The system will automatically prevent overlapping time slots for the same resource.</span>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-blue-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors shadow-sm">
              {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Confirm Booking"}
            </button>
          </form>
        </div>

        {/* Calendar View */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col p-4 h-[600px]">
           <h2 className="text-lg font-bold text-gray-800 mb-4">Availability Calendar</h2>
           <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: "100%" }}
              eventPropGetter={(event) => {
                let backgroundColor = '#3b82f6';
                if (event.status === 'Cancelled') backgroundColor = '#ef4444';
                if (event.status === 'Completed') backgroundColor = '#10b981';
                return { style: { backgroundColor } };
              }}
            />
        </div>
      </div>
    </div>
  );
};

export default BookingView;
