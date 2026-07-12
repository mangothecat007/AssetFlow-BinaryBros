import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { tokenStore } from "@/lib/api";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const success = await login(username, password);
      if (success) {
        toast.success("Authentication successful");
        navigate("/app/dashboard");
      } else {
        toast.error("Invalid credentials");
        setLoading(false);
      }
    } catch (err) {
      toast.error("An error occurred during login");
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
          <h1 className="text-2xl font-bold">Welcome Back</h1>
          <p className="text-blue-100 mt-2 text-sm">Login to your AssetFlow account.</p>
        </div>
        
        <form onSubmit={handleLogin} className="p-8 space-y-6">
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
            {loading ? "Authenticating..." : "Log In"}
          </button>
          
          <div className="text-center text-sm text-gray-600">
            Don't have an account? <Link to="/signup" className="text-blue-600 font-bold hover:underline">Sign up</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
