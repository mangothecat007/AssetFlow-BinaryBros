import React, { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Clock, XCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

const BookingView = () => {
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [loading, setLoading] = useState(false);
  const [overlapError, setOverlapError] = useState("");

  useEffect(() => {
    api.get("/assets").then(res => setAssets(res.data)).catch(console.error);
  }, []);

  const handleBook = async (e) => {
    e.preventDefault();
    setOverlapError("");
    if (!selectedAsset || !date || !startTime || !endTime) return toast.error("Fill all fields");
    
    // Combine date and time for backend
    const start_time = `${date}T${startTime}:00`;
    const end_time = `${date}T${endTime}:00`;

    if (new Date(start_time) >= new Date(end_time)) {
      return toast.error("End time must be after start time");
    }

    setLoading(true);
    try {
      await api.post("/bookings", {
        id: "book_" + Date.now(),
        asset_id: selectedAsset,
        booked_by: "Current User",
        start_time,
        end_time,
        status: "Active"
      });
      toast.success("Slot booked successfully!");
      setSelectedAsset("");
      setDate("");
    } catch (e) {
      if (e.response && e.response.status === 409) {
        setOverlapError("This slot conflicts with an existing booking.");
      } else {
        toast.error("Booking failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Resource Booking</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        
        {/* Resource Selector & Form */}
        <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl p-6 shadow-sm h-fit">
          <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Book a Slot</h2>
          <form className="space-y-4" onSubmit={handleBook}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resource</label>
              <select 
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 bg-white"
              >
                <option value="">-- Choose Resource --</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 bg-white" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="time" 
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full pl-9 pr-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 bg-white" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="time" 
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full pl-9 pr-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 bg-white" 
                  />
                </div>
              </div>
            </div>
            
            {overlapError && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex gap-2 items-start mt-2 border border-red-200">
                <XCircle className="w-5 h-5 flex-shrink-0" />
                <p><strong>Overlap Detected:</strong> {overlapError}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full bg-blue-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors hover:bg-blue-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Book Slot"}
            </button>
          </form>
        </div>

        {/* Calendar View Mockup */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">Tue, 7 Jul - Conference Room B2</h2>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto relative min-h-[400px]">
            {/* Timeline Background */}
            <div className="absolute inset-0 p-4 pt-6">
               {[8, 9, 10, 11, 12, 1, 2, 3, 4, 5].map((hour) => (
                 <div key={hour} className="flex gap-4 h-16 border-b border-gray-100">
                   <div className="w-12 text-right text-xs text-gray-400 -mt-2">{hour}:00 {hour >= 8 && hour < 12 ? 'AM' : 'PM'}</div>
                   <div className="flex-1 border-l border-gray-200 relative">
                      {/* Booking block mockups based on time */}
                      {hour === 9 && (
                        <div className="absolute top-8 left-2 right-2 h-16 bg-blue-100 border border-blue-300 rounded-md p-2 z-10 shadow-sm flex flex-col justify-center">
                          <span className="text-xs font-bold text-blue-800">Booked - Procurement Team</span>
                          <span className="text-[10px] text-blue-600">9:30 - 10:30</span>
                        </div>
                      )}
                      
                      {/* Attempted block overlap visualization */}
                      {hour === 9 && (
                         <div className="absolute top-0 left-2 right-2 h-16 border-2 border-dashed border-red-400 bg-red-50/50 rounded-md z-0 pointer-events-none flex items-center justify-center opacity-50">
                           <span className="text-[10px] font-bold text-red-500 bg-white px-1">Requested 9:00 - 10:00</span>
                         </div>
                      )}
                   </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default BookingView;
