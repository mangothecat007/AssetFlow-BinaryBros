import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Activity, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { tokenStore } from "@/lib/api";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showBackendDropdown, setShowBackendDropdown] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [isPassphraseCorrect, setIsPassphraseCorrect] = useState(false);
  const [expectedPassphrase, setExpectedPassphrase] = useState("config");
  const [backendUrl, setBackendUrl] = useState(
    localStorage.getItem("assetflow_backend_url") ||
      import.meta.env.VITE_BACKEND_URL ||
      "http://localhost:8082",
  );
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const originalError = console.error;
    const originalWarn = console.warn;
    console.error = () => {};
    console.warn = () => {};

    try {
      const success = await login(username, password);
      if (success) {
        toast.success("Authentication successful");
        navigate("/app/dashboard");
        try {
          const token = tokenStore.get();
          const isHttps = backendUrl.startsWith("https");
          const fetchOptions = (token && !isHttps) 
            ? { headers: { Authorization: `Bearer ${token}` } } 
            : { credentials: "include" };
          const resp = await fetch(`${backendUrl}/get_passphrase`, fetchOptions);
          const data = await resp.json();
          setExpectedPassphrase(data.passphrase);
        } catch (err) {
          // console.error hidden
        }
      } else {
        toast.error("Invalid credentials");
        setLoading(false);
      }
    } finally {
      console.error = originalError;
      console.warn = originalWarn;
    }
  };

  const saveBackendUrl = () => {
    localStorage.setItem("assetflow_backend_url", backendUrl);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 text-white relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[radial-gradient(circle_at_center,var(--primary),transparent)] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[radial-gradient(circle_at_center,var(--primary),transparent)] rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="relative inline-block mb-6">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--surface)] border border-[var(--border)] cursor-pointer hover:border-[var(--primary)]/50 transition-colors"
              onClick={() => setShowBackendDropdown(!showBackendDropdown)}
            >
              <div className="w-10 h-10 bg-[var(--primary)] rounded-lg flex items-center justify-center font-bold text-black text-xl">AF</div>
            </div>

            {showBackendDropdown && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[85vw] max-w-[250px] bg-[var(--surface)] border border-[var(--border)] p-3 shadow-lg z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                {!isPassphraseCorrect ? (
                  <>
                    <div className="text-xs text-[var(--text-secondary)] uppercase mb-2 font-mono text-left">
                      Passphrase
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="password"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        className="w-full bg-[var(--bg)] border border-[var(--border)] pl-3 pr-14 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] font-mono"
                        placeholder="Enter passphrase"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (passphrase === expectedPassphrase)
                              setIsPassphraseCorrect(true);
                            else toast.error("Incorrect passphrase");
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (passphrase === expectedPassphrase)
                            setIsPassphraseCorrect(true);
                          else toast.error("Incorrect passphrase");
                        }}
                        className="absolute right-1 px-2 py-1 bg-[var(--primary)] text-black text-xs font-bold uppercase hover:opacity-90"
                      >
                        Go
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-[var(--text-secondary)] uppercase mb-2 font-mono text-left">
                      Backend URL
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={backendUrl}
                        onChange={(e) => setBackendUrl(e.target.value)}
                        className="w-full bg-[var(--bg)] border border-[var(--border)] pl-3 pr-14 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] font-mono"
                        placeholder="http://localhost:8082"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveBackendUrl();
                        }}
                      />
                      <button
                        onClick={saveBackendUrl}
                        className="absolute right-1 px-2 py-1 bg-[var(--primary)] text-black text-xs font-bold uppercase hover:opacity-90"
                      >
                        Set
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-[var(--primary)] mb-2">
            AssetFlow ERP
          </h1>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black/50 border border-[var(--border)] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--primary)] transition-colors"
                placeholder="Enter username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/50 border border-[var(--border)] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--primary)] transition-colors"
                placeholder="Enter password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--primary)] text-black font-medium py-3 rounded-xl hover:bg-[var(--primary)]/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Authenticate
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
