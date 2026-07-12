import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return toast.error("Please enter a valid email address");
    
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/;
    if (!passRegex.test(password)) {
      return toast.error("Password must be at least 8 characters, include an uppercase letter, lowercase letter, and a number");
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/signup", { email, password });
      toast.success(`Account created! You are assigned as ${res.data.role}`);
      // Auto-login after signup
      const success = await login(email, password);
      if (success) {
        navigate("/app/dashboard");
      } else {
        navigate("/login");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[var(--bg)] items-center justify-center p-4">
      <div className="w-full max-w-md bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--border)] overflow-hidden">
        <div className="p-8 text-center border-b border-[var(--border)]">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4 font-bold bg-[var(--primary)] text-black text-xl shadow-sm">
            AF
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Join AssetFlow</h1>
          <p className="text-[var(--text-secondary)] mt-2 text-sm">Create an employee account to get started.</p>
        </div>
        
        <form onSubmit={handleSignup} className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full p-3 bg-transparent border border-[var(--border)] text-[var(--text-primary)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none transition-all" 
              placeholder="e.g. employee@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Password</label>
            <input 
              type="password" 
              required
              className="w-full p-3 bg-transparent border border-[var(--border)] text-[var(--text-primary)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none transition-all" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[var(--primary)] text-black font-bold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
          
          <div className="text-center text-sm text-[var(--text-secondary)]">
            Already have an account? <Link to="/login" className="text-[var(--primary)] font-bold hover:underline">Log in</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Signup;
