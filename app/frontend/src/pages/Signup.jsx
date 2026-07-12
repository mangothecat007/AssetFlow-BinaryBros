import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, userStore } from "@/lib/api";
import toast from "react-hot-toast";

const Signup = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/auth/signup", { username, password });
      toast.success(`Account created! You are assigned as ${res.data.role}`);
      // Auto-login after signup
      const loginRes = await api.post("/auth/login", { username, password });
      userStore.setToken(loginRes.data.access_token);
      userStore.setRole(loginRes.data.role);
      navigate("/app/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f3f4f6] items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-8 text-center bg-blue-600 text-white">
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center mx-auto mb-4 font-bold text-blue-600 text-xl shadow-sm">
            AF
          </div>
          <h1 className="text-2xl font-bold">Join AssetFlow</h1>
          <p className="text-blue-100 mt-2 text-sm">Create an employee account to get started.</p>
        </div>
        
        <form onSubmit={handleSignup} className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
            <input 
              type="text" 
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
              placeholder="e.g. employee01"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input 
              type="password" 
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
          
          <div className="text-center text-sm text-gray-600">
            Already have an account? <Link to="/login" className="text-blue-600 font-bold hover:underline">Log in</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Signup;
