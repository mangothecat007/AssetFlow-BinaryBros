import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { tokenStore } from "@/lib/api";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const success = await login(email, password);
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
    <div className="flex h-screen bg-[var(--bg)] items-center justify-center p-4">
      <div className="w-full max-w-md bg-[var(--surface)] rounded-xl shadow-lg border border-[var(--border)] overflow-hidden">
        <div className="p-8 text-center border-b border-[var(--border)]">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4 font-bold bg-[var(--primary)] text-black text-xl shadow-sm">
            AF
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Welcome Back</h1>
          <p className="text-[var(--text-secondary)] mt-2 text-sm">Login to your AssetFlow account.</p>
        </div>
        
        <form onSubmit={handleLogin} className="p-8 space-y-6">
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
            <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-[var(--text-primary)]">Password</label>
                <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-[var(--primary)] hover:underline font-medium">Forgot Password?</button>
            </div>
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
            {loading ? "Authenticating..." : "Log In"}
          </button>
          
          <div className="text-center text-sm text-[var(--text-secondary)]">
            Don't have an account? <Link to="/signup" className="text-[var(--primary)] font-bold hover:underline">Sign up</Link>
          </div>
        </form>
      </div>

      {showForgot && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-bold text-lg text-[var(--text-primary)] mb-2">Reset Password</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-4">Enter your email address to receive a password reset link.</p>
            <form onSubmit={(e) => {
                e.preventDefault();
                toast.success("If an account exists, a password reset link has been sent.");
                setShowForgot(false);
            }} className="space-y-4">
              <input 
                type="email" required
                value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                className="w-full p-2 bg-transparent border border-[var(--border)] text-[var(--text-primary)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] outline-none text-sm" 
                placeholder="Enter email address"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowForgot(false)} className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-[var(--primary)] text-black font-bold rounded-lg hover:opacity-90">Send Link</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
