import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

// Data Options
const GENRES = ["Action", "Adventure", "RPG", "Strategy", "Simulation", "Sports", "Racing", "Puzzle", "Shooter", "Platformer", "Fighting", "Stealth", "Survival", "Horror"];
const PLATFORMS = ["PC", "Console", "Mobile"];
const MODES = ["Singleplayer", "Multiplayer"];

function Survey({ user }) {
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [selectedModes, setSelectedModes] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Helper to toggle items in a list
  const toggleItem = (item, list, setList) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleSubmit = async () => {
    if (selectedGenres.length === 0) {
        alert("Please select at least one genre!");
        return;
    }
    // Optional: Force platform selection? Let's make it optional (implies all).
    
    setLoading(true);

    const payload = {
        genres: selectedGenres,
        platforms: selectedPlatforms,
        modes: selectedModes
    };

    if (user) {
        // Logged In: Save to DB
        try {
            await fetch("http://127.0.0.1:5000/survey", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: user, ...payload }),
            });
            navigate("/recommendations");
        } catch (err) {
            console.error("Survey Error:", err);
            alert("Server error.");
        }
    } else {
        // Guest: Pass via State
        navigate("/recommendations", { state: payload });
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 relative overflow-y-auto custom-scrollbar">
      
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-black to-black opacity-80 z-0 pointer-events-none"></div>

      <div className="relative z-10 max-w-5xl w-full py-10">
        <div className="text-center mb-10">
            <h1 className="text-5xl font-black tracking-tight mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
                Setup Your Profile
              </span>
            </h1>
            <p className="text-xl text-gray-400">
                Customize your gaming preferences.
            </p>
        </div>

        {/* 1. GENRES */}
        <div className="mb-10">
            <h3 className="text-2xl font-bold mb-4 border-l-4 border-red-500 pl-3">1. Favorite Genres</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {GENRES.map((genre) => {
                const isSelected = selectedGenres.includes(genre);
                return (
                <button
                    key={genre}
                    onClick={() => toggleItem(genre, selectedGenres, setSelectedGenres)}
                    className={`py-3 px-2 rounded-lg font-bold text-sm transition-all duration-300 border backdrop-blur-sm
                    ${isSelected 
                        ? "bg-red-600/20 border-red-500 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]" 
                        : "bg-gray-900/40 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
                    }`}
                >
                    {genre}
                </button>
                );
            })}
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12">
            {/* 2. PLATFORMS */}
            <div>
                <h3 className="text-2xl font-bold mb-4 border-l-4 border-blue-500 pl-3">2. Select Device</h3>
                <div className="flex gap-3">
                    {PLATFORMS.map((p) => {
                        const isSelected = selectedPlatforms.includes(p);
                        return (
                            <button
                                key={p}
                                onClick={() => toggleItem(p, selectedPlatforms, setSelectedPlatforms)}
                                className={`flex-1 py-4 rounded-xl font-bold transition-all border
                                ${isSelected 
                                    ? "bg-blue-600/20 border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]" 
                                    : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500 hover:bg-gray-800"
                                }`}
                            >
                                {p}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* 3. MODES */}
            <div>
                <h3 className="text-2xl font-bold mb-4 border-l-4 border-green-500 pl-3">3. Play Style</h3>
                <div className="flex gap-3">
                    {MODES.map((m) => {
                        const isSelected = selectedModes.includes(m);
                        return (
                            <button
                                key={m}
                                onClick={() => toggleItem(m, selectedModes, setSelectedModes)}
                                className={`flex-1 py-4 rounded-xl font-bold transition-all border
                                ${isSelected 
                                    ? "bg-green-600/20 border-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]" 
                                    : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500 hover:bg-gray-800"
                                }`}
                            >
                                {m}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-center border-t border-gray-800 pt-8">
            <Link to="/" className="text-gray-500 hover:text-white transition px-6 py-3">
                Cancel
            </Link>
            
            <button
                onClick={handleSubmit}
                disabled={loading}
                className={`
                    px-12 py-4 rounded-full font-bold text-lg transition-all duration-300 shadow-lg
                    ${loading 
                        ? "bg-gray-700 cursor-wait text-gray-400" 
                        : "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white hover:scale-105 hover:shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                    }
                `}
            >
                {loading ? "Analyzing..." : "Find My Games →"}
            </button>
        </div>
      </div>
    </div>
  );
}

export default Survey;