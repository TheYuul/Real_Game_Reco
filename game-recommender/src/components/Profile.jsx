import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

const GENRES = ["Action", "Adventure", "RPG", "Strategy", "Simulation", "Sports", "Racing", "Puzzle", "Shooter", "Platformer", "Fighting", "Stealth", "Survival", "Horror"];
const PLATFORMS = ["PC", "Console", "Mobile"];
const MODES = ["Singleplayer", "Multiplayer"];

export default function Profile({ user }) {
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [selectedModes, setSelectedModes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [stats, setStats] = useState({ accuracy: 0, genre_data: [] });

  useEffect(() => {
    if (!user) { navigate("/"); return; }
    
    // Fetch existing preferences
    fetch(`http://127.0.0.1:5000/user/preferences/${user}`)
      .then(res => res.json())
      .then(data => {
        setSelectedGenres(data.genres || []);
        setSelectedPlatforms(data.platforms || []);
        setSelectedModes(data.modes || []);
        setLoading(false);
      });

      fetch(`http://127.0.0.1:5000/user/stats/${user}`)
      .then(res => res.json())
      .then(data => setStats(data));
  }, [user, navigate]);

  const toggleItem = (item, list, setList) => {
    list.includes(item) ? setList(list.filter(i => i !== item)) : setList([...list, item]);
  };

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await fetch("http://127.0.0.1:5000/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            user_id: user, 
            genres: selectedGenres, 
            platforms: selectedPlatforms, 
            modes: selectedModes 
        }),
      });
      alert("Preferences updated! Your recommendations will now refresh.");
      navigate("/recommendations");
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading Profile...</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-12">
            <div>
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">My Profile</h1>
                <p className="text-gray-400">Manage your AI filters and gaming identity.</p>
            </div>
            <Link to="/" className="text-gray-500 hover:text-white transition">← Home</Link>
        </header>

        <div className="space-y-12">

            {/* AI Insights */}
            <section className="mb-12 bg-gray-900/50 border border-gray-800 rounded-2xl p-8 backdrop-blur-sm">
                <div className="flex flex-col md:flex-row items-center gap-10">
                    
                    {/* Match Accuracy Circle */}
                    <div className="relative w-32 h-32 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-800" />
                            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" 
                                strokeDasharray={364.4} 
                                strokeDashoffset={364.4 - (364.4 * stats.accuracy) / 100} 
                                className="text-red-500 transition-all duration-1000" 
                            />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                            <span className="text-3xl font-black">{stats.accuracy}%</span>
                            <span className="text-[10px] text-gray-500 uppercase font-bold">Accuracy</span>
                        </div>
                    </div>

                    {/* Genre Power Levels */}
                    <div className="flex-1 w-full">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">AI Taste Analysis</h3>
                        <div className="space-y-4">
                            {stats.genre_data.length > 0 ? stats.genre_data.map(g => (
                                <div key={g.name}>
                                    <div className="flex justify-between text-xs font-bold mb-1">
                                        <span>{g.name}</span>
                                        <span className="text-gray-500">{g.value} pts</span>
                                    </div>
                                    <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                                        <div 
                                            className="bg-gradient-to-r from-red-600 to-orange-500 h-full transition-all duration-1000" 
                                            style={{ width: `${Math.min((g.value / 20) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-gray-600 italic text-sm">Rate more games to see your AI insights!</p>
                            )}
                        </div>
                    </div>
                </div>
            </section>
            
            {/* Genre Section */}
            <section>
                <h3 className="text-xl font-bold mb-4 text-red-500 uppercase tracking-widest">Target Genres</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {GENRES.map(g => (
                        <button key={g} onClick={() => toggleItem(g, selectedGenres, setSelectedGenres)}
                            className={`p-3 rounded-lg border text-sm font-bold transition ${selectedGenres.includes(g) ? "bg-red-600/20 border-red-500" : "bg-gray-900 border-gray-800 text-gray-500"}`}>
                            {g}
                        </button>
                    ))}
                </div>
            </section>

            {/* Platform & Mode */}
            <div className="grid md:grid-cols-2 gap-8">
                <section>
                    <h3 className="text-xl font-bold mb-4 text-blue-500 uppercase tracking-widest">Platform</h3>
                    <div className="flex gap-2">
                        {PLATFORMS.map(p => (
                            <button key={p} onClick={() => toggleItem(p, selectedPlatforms, setSelectedPlatforms)}
                                className={`flex-1 p-3 rounded-lg border font-bold transition ${selectedPlatforms.includes(p) ? "bg-blue-600/20 border-blue-500" : "bg-gray-900 border-gray-800 text-gray-500"}`}>
                                {p}
                            </button>
                        ))}
                    </div>
                </section>
                <section>
                    <h3 className="text-xl font-bold mb-4 text-green-500 uppercase tracking-widest">Modes</h3>
                    <div className="flex gap-2">
                        {MODES.map(m => (
                            <button key={m} onClick={() => toggleItem(m, selectedModes, setSelectedModes)}
                                className={`flex-1 p-3 rounded-lg border font-bold transition ${selectedModes.includes(m) ? "bg-green-600/20 border-green-500" : "bg-gray-900 border-gray-800 text-gray-500"}`}>
                                {m}
                            </button>
                        ))}
                    </div>
                </section>
            </div>

            <button onClick={handleUpdate} className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-600 rounded-full font-black text-xl hover:scale-[1.02] transition-transform shadow-lg">
                SAVE CHANGES
            </button>
        </div>
      </div>
    </div>
  );
}