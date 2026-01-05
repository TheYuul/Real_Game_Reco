import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import GameDetailsModal from "./GameDetailsModal";

export default function Home({ user, onLogout, onLogin }) {
  const [games, setGames] = useState([]);
  const [filteredGames, setFilteredGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAccount, setShowAccount] = useState(false);
  const [accountMode, setAccountMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  // Modal State
  const [selectedGame, setSelectedGame] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Survey Status
  const [hasHistory, setHasHistory] = useState(false);

  // NEW: Filtering and Sorting States
  const [activeGenre, setActiveGenre] = useState("All");
  const [sortBy, setSortBy] = useState("title"); // "title" or "release_date"

  const GENRES = ["All", "Action", "RPG", "Shooter", "Survival", "Adventure", "Strategy", "Casual"];

  useEffect(() => {
    fetch("http://127.0.0.1:5000/games")
      .then(res => res.json())
      .then(data => {
        const sortedGames = data.sort((a, b) => a.title.localeCompare(b.title));
        setGames(sortedGames);
        setFilteredGames(sortedGames);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching games:", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = games.filter(game =>
        game.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredGames(filtered);
    } else {
      setFilteredGames(games);
    }
  }, [searchQuery, games]);

  useEffect(() => {
    if (user) {
        fetch("http://127.0.0.1:5000/recommend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: user }),
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === "cold_start") {
                setHasHistory(false); 
            } else {
                setHasHistory(true);  
            }
        })
        .catch(err => console.error(err));
    }
  }, [user]);

  // UPDATE: Logic for filtering and sorting
  useEffect(() => {
    let result = [...games];

    // 1. Search Query Filter
    if (searchQuery) {
      result = result.filter(game =>
        game.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // 2. Genre Filter (New)
    if (activeGenre !== "All") {
      // Note: We check if the genre exists as a feature in the game data
      // Based on your mapping: Action -> competitive, etc.
      const genreMap = {
        "Action": "competitive", "RPG": "rpg", "Shooter": "shooter", 
        "Survival": "survival", "Adventure": "open_world", 
        "Strategy": "rpg", "Casual": "casual"
      };
      const featureKey = genreMap[activeGenre];
      result = result.filter(game => game[featureKey] >= 1 || game.genre === activeGenre);
    }

    // 3. Sorting (New)
    result.sort((a, b) => {
      if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      } else if (sortBy === "release_date") {
        // Sort by date (Newest first)
        return new Date(b.release_date || 0) - new Date(a.release_date || 0);
      }
      return 0;
    });

    setFilteredGames(result);
  }, [searchQuery, activeGenre, sortBy, games]);

  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const endpoint = accountMode === "login" ? "/login" : "/register";
    try {
      const response = await fetch(`http://127.0.0.1:5000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (response.ok) {
        onLogin(username);
        setShowAccount(false);
        setUsername("");
        setPassword("");
      } else {
        setError(data.error || "Authentication failed");
      }
    } catch (err) {
      setError("Server error. Please try again.");
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Are you sure? This will delete your survey results and rated games.")) return;

    try {
      const res = await fetch("http://127.0.0.1:5000/reset_profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user }),
      });

      if (res.ok) {
        alert("Profile reset! You can now start fresh.");
        setShowAccount(false);
      } else {
        alert("Failed to reset profile.");
      }
    } catch (err) {
      console.error(err);
      alert("Error resetting profile.");
    }
  };

  // --- SIMPLIFIED CLICK HANDLER ---
  const handleGameClick = (game) => {
    setSelectedGame(game);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedGame(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading games...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-red-500 selection:text-white">
      
      {/* HEADER */}
      <header className="flex justify-between items-center p-6 sticky top-0 z-40 border-b border-gray-800 backdrop-blur-md bg-black/70">
        <h1 className="text-3xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 pr-2">
          GameRecommender
        </h1>

        <div className="flex items-center gap-4">
          
          {/* SEARCH BAR */}
          <div className={`flex items-center bg-gray-900/80 border rounded-full px-3 py-2 transition-all duration-300 
            ${showSearch 
              ? "border-red-500/50 ring-2 ring-red-500/20 shadow-[0_0_15px_rgba(220,38,38,0.5)]" 
              : "border-gray-700 hover:border-red-500 hover:shadow-[0_0_15px_rgba(220,38,38,0.5)]" 
            }`}
          >
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="text-gray-400 hover:text-white transition focus:outline-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <input
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none ml-2 transition-all duration-300 ${
                showSearch ? "w-48 opacity-100" : "w-0 opacity-0"
              }`}
            />
          </div>

          {/* ACCOUNT BUTTON */}
          <button 
            onClick={() => setShowAccount(!showAccount)}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-900/80 border border-gray-700 hover:border-red-500 hover:bg-gray-800 transition-all duration-300 group shadow-lg hover:shadow-[0_0_15px_rgba(220,38,38,0.5)]"
          >
            {user ? (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                    {user.charAt(0).toUpperCase()}
                </div>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            )}
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative h-[500px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-800 via-black to-black opacity-80"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        
        <div className="relative z-10 text-center px-4 max-w-4xl">
          <h2 className="text-6xl md:text-7xl font-black mb-6 tracking-tight drop-shadow-2xl">
            FIND YOUR <span className="text-red-600">OBSESSION</span>
          </h2>
          <p className="text-xl md:text-2xl mb-8 text-gray-300 font-light">
            {user 
              ? `Welcome back, ${user}. Let's find your next 100-hour adventure.` 
              : "AI-powered recommendations based on the games you actually play."}
          </p>
          
          <div className="flex justify-center gap-6">
            {user ? (
              <>
                <Link
                  to="/recommendations"
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-full text-lg font-bold transition transform hover:scale-105 shadow-[0_0_20px_rgba(220,38,38,0.5)]"
                >
                  View Recommendations
                </Link>
                <Link
                  to="/survey"
                  className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-4 rounded-full text-lg font-bold transition transform hover:scale-105 border border-gray-600"
                >
                  {hasHistory ? "Retake Survey" : "Take Survey"}
                </Link>
              </>
            ) : (
              <Link
                to="/survey"
                className="bg-white text-black hover:bg-gray-200 px-10 py-4 rounded-full text-xl font-bold transition transform hover:scale-105 shadow-xl"
              >
                Start Matching →
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* NEW: FILTER & SORT BAR */}
      <section className="max-w-7xl mx-auto px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-6 border-b border-gray-800">
        
        {/* Genre Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
          {GENRES.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGenre(g)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all border ${
                activeGenre === g 
                ? "bg-red-600 border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]" 
                : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-gray-500 text-sm font-bold uppercase tracking-widest">Sort By:</span>
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-gray-900 border border-gray-700 
            text-white px-4 py-2 rounded-lg text-sm font-bold outline-none 
            focus:border-red-500 transition-colors hover:border-gray-500
            cursor-pointer"
          >
            <option value="title">Alphabetical (A-Z)</option>
            <option value="release_date">Release Date (Newest)</option>
          </select>
        </div>
      </section>

      {/* LIBRARY GRID */}
      <section className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
            <div className="h-8 w-2 bg-red-600 rounded-full"></div>
            <h3 className="text-3xl font-bold">All Games</h3>
            <span className="text-gray-500 text-sm mt-2">{filteredGames.length} games</span>
        </div>

        {filteredGames.length === 0 ? (
           <div className="text-center py-20 text-gray-500">
               <p className="text-2xl font-bold">No games found.</p>
               <p>Try searching for something else.</p>
           </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredGames.map(game => (
                <div
                key={game.game_id}
                onClick={() => handleGameClick(game)}
                className="bg-gray-900 rounded-xl overflow-hidden cursor-pointer group relative border border-gray-800 hover:border-red-500/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(220,38,38,0.2)] hover:-translate-y-2"
                >
                <div className="overflow-hidden h-[200px] relative">
                    <img
                    src={game.image_url || game.image}
                    alt={game.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    onError={(e) => {
                        e.target.src = "https://placehold.co/400x500/333/fff?text=No+Image";
                    }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-90"></div>
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h4 className="text-xl font-bold text-white leading-tight mb-1 drop-shadow-md">{game.title}</h4>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
                            {game.genre || "Action"}
                        </span>
                    </div>
                </div>
                </div>
            ))}
            </div>
        )}
      </section>

      {/* ACCOUNT MODAL */}
      {showAccount && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-gray-900 text-white p-8 rounded-2xl max-w-md w-full mx-4 shadow-2xl border border-gray-700 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2"></div>

            {user ? (
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-6 text-center">My Account</h3>
                <div className="bg-black/40 p-6 rounded-xl mb-6 text-center border border-gray-800">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-700 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl font-bold shadow-lg">
                      {user.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-gray-400 text-sm">Currently logged in as</p>
                  <p className="text-xl font-bold text-white">{user}</p>
                </div>

                <Link
                  to="/library"
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition mb-3 text-center"
                >
                  📚 My Library
                </Link>

                <Link
                  to="/history"
                  className="block w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition mb-3 text-center"
                >
                  📜 View Rating History
                </Link>

                <button
                  onClick={handleReset}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 mb-3 rounded-xl font-bold transition"
                >
                  ⚠️ Reset Profile Data
                </button>

                <button
                  onClick={() => { onLogout(); setShowAccount(false); }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold transition shadow-lg"
                >
                  Logout
                </button>

                <button
                  onClick={() => setShowAccount(false)}
                  className="w-full mt-6 text-gray-500 hover:text-white transition"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-6 text-center">
                  {accountMode === "login" ? "Welcome Back" : "Join the Squad"}
                </h3>
                
                <div className="flex mb-6 gap-2 bg-black/40 p-1 rounded-xl">
                  <button
                    onClick={() => setAccountMode("login")}
                    className={`flex-1 py-2 rounded-lg font-bold transition ${accountMode === "login" ? "bg-gray-800 text-white shadow" : "text-gray-500 hover:text-white"}`}
                  >
                    Login
                  </button>
                  <button
                    onClick={() => setAccountMode("register")}
                    className={`flex-1 py-2 rounded-lg font-bold transition ${accountMode === "register" ? "bg-gray-800 text-white shadow" : "text-gray-500 hover:text-white"}`}
                  >
                    Register
                  </button>
                </div>

                {error && (
                  <div className="bg-red-900/30 border border-red-500/50 text-red-200 p-3 rounded-lg mb-4 text-sm text-center">
                    {error}
                  </div>
                )}

                <form onSubmit={handleAccountSubmit} className="space-y-4">
                  <div>
                    <input
                      type="text"
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full p-4 bg-black/50 border border-gray-700 rounded-xl focus:outline-none focus:border-red-500 text-white placeholder-gray-500 transition"
                      required
                    />
                  </div>
                  <div>
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full p-4 bg-black/50 border border-gray-700 rounded-xl focus:outline-none focus:border-red-500 text-white placeholder-gray-500 transition"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white py-4 rounded-xl font-bold transition shadow-lg transform hover:scale-[1.02] mt-2"
                  >
                    {accountMode === "login" ? "Login" : "Create Account"}
                  </button>
                </form>
                <button
                  onClick={() => setShowAccount(false)}
                  className="w-full mt-6 text-gray-500 hover:text-white text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NEW GAME DETAILS MODAL */}
      <GameDetailsModal 
        game={selectedGame} 
        isOpen={isModalOpen} 
        onClose={closeModal} 
        user={user} // Pass user prop for library features
      />
    </div>
  );
}