import React, { useState, useEffect } from "react";

export default function GameDetailsModal({ game, isOpen, onClose, user }) {
  const [details, setDetails] = useState(null);
  const [similarGames, setSimilarGames] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Library Status State
  const [status, setStatus] = useState("Add to Library");
  const [statusLoading, setStatusLoading] = useState(false);

  // ---------------------------------------------------------
  // FIX 1: SCROLL LOCK EFFECT (Separated & Robust)
  // ---------------------------------------------------------
  useEffect(() => {
    if (isOpen) {
      // Lock scroll when open
      document.body.style.overflow = "hidden";
    } else {
      // Restore scroll when closed
      document.body.style.overflow = ""; 
    }

    // CLEANUP: Always unlock scroll when component unmounts
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // ---------------------------------------------------------
  // FIX 2: DATA FETCHING EFFECT (Separated)
  // ---------------------------------------------------------
  useEffect(() => {
    if (isOpen && game?.game_id) {
      setLoading(true);
      
      // 1. Fetch Game Details
      const fetchDetails = fetch(`http://127.0.0.1:5000/game/${game.game_id}`)
        .then(res => res.json());

      // 2. Fetch Similar Games
      const fetchSimilar = fetch("http://127.0.0.1:5000/recommend/game", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ game_id: game.game_id }),
      }).then(res => res.json());

      // 3. Fetch User Library Status (if logged in)
      let fetchStatus = Promise.resolve(null);
      if (user) {
          fetchStatus = fetch(`http://127.0.0.1:5000/library/${user}`)
            .then(res => res.json())
            .then(data => {
                const found = data.find(item => item.game_id === game.game_id);
                return found ? found.status : "Add to Library";
            })
            .catch(err => console.error("Library fetch error:", err));
      }

      Promise.all([fetchDetails, fetchSimilar, fetchStatus])
        .then(([detailData, similarData, statusData]) => {
          setDetails(detailData);
          setSimilarGames(similarData.recommendations || []);
          if (statusData) setStatus(statusData);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to load game details", err);
          setLoading(false);
        });

    } else {
      // Reset Data when closed
      setDetails(null);
      setSimilarGames([]);
      setStatus("Add to Library");
    }
  }, [isOpen, game, user]);

  const handleStatusChange = async (newStatus) => {
      if (!user) {
          alert("Please login to manage your library.");
          return;
      }
      setStatus(newStatus);
      setStatusLoading(true);
      
      try {
          await fetch("http://127.0.0.1:5000/library/update", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  user_id: user,
                  game_id: game.game_id,
                  status: newStatus
              })
          });
      } catch (err) {
          console.error("Failed to update status", err);
      } finally {
          setStatusLoading(false);
      }
  };

  if (!isOpen || !game) return null;
  const displayGame = details || game;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Container */}
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-[#1b2838] rounded-xl shadow-2xl border border-gray-700 overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-start p-6 bg-gradient-to-r from-gray-900 to-[#1b2838] border-b border-gray-700 shrink-0">
            <h2 className="text-3xl font-bold text-white tracking-tight drop-shadow-md">
                {displayGame.title}
            </h2>
            <button 
                onClick={onClose}
                className="text-gray-400 hover:text-white hover:bg-white/10 p-2 rounded-full transition-all"
            >
                ✕
            </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-0 custom-scrollbar">
            
            <div className="flex flex-col md:flex-row bg-[#0f1922]">
                {/* Main Image */}
                <div className="md:w-2/3 relative h-[300px] md:h-[400px]">
                    <img 
                        src={displayGame.image_url || displayGame.image} 
                        alt={displayGame.title} 
                        className="w-full h-full object-cover"
                        onError={(e) => e.target.src = "https://placehold.co/600x400/333/fff?text=No+Image"}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f1922] to-transparent opacity-80"></div>
                </div>

                {/* Sidebar */}
                <div className="md:w-1/3 p-6 flex flex-col gap-4 bg-[#1b2838]/50 backdrop-blur-md border-l border-gray-800">
                    
                    <img 
                        src={displayGame.image_url || displayGame.image} 
                        className="w-full h-32 object-cover rounded border border-gray-600 shadow-lg mb-2 hidden md:block" 
                        alt="box art"
                    />

                    <div className="text-gray-300 text-sm leading-relaxed line-clamp-4">
                        {displayGame.description || "Loading description..."}
                    </div>
                    
                    {/* Status Dropdown */}
                    <div className="mt-4">
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Library Status</label>
                        <select 
                            value={status}
                            onChange={(e) => handleStatusChange(e.target.value)}
                            disabled={statusLoading}
                            className={`w-full p-3 rounded font-bold text-sm text-white border transition-all cursor-pointer outline-none appearance-none
                                ${status === "Playing" ? "bg-green-600 border-green-500" : 
                                  status === "Completed" ? "bg-blue-600 border-blue-500" :
                                  status === "Dropped" ? "bg-red-600 border-red-500" :
                                  status === "Plan to Play" ? "bg-gray-600 border-gray-500" :
                                  "bg-gray-800 border-gray-600 hover:bg-gray-700"
                                }`}
                        >
                            <option value="Add to Library">➕ Add to Library</option>
                            <option value="Plan to Play">📅 Plan to Play</option>
                            <option value="Playing">🎮 Playing</option>
                            <option value="Completed">🏆 Completed</option>
                            <option value="Dropped">🛑 Dropped</option>
                            {status !== "Add to Library" && <option value="Remove">❌ Remove from Library</option>}
                        </select>
                    </div>

                    {/* Metadata Grid */}
                    <div className="mt-auto space-y-2 text-xs">
                        <div className="flex justify-between border-b border-gray-700 pb-1">
                            <span className="text-gray-500">RELEASE DATE</span>
                            <span className="text-gray-300">{displayGame.release_date || "Unknown"}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-700 pb-1">
                            <span className="text-gray-500">DEVELOPER</span>
                            <span className="text-blue-400">{displayGame.developer || "Unknown Studio"}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-700 pb-1">
                            <span className="text-gray-500">PUBLISHER</span>
                            <span className="text-blue-400">{displayGame.publisher || "Unknown"}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-700 pb-1">
                            <span className="text-gray-500">PLATFORM</span>
                            <span className="text-gray-300">{(displayGame.platform || "PC").split(';').join(', ')}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Description */}
            <div className="p-8 bg-[#1b2838]">
                <h3 className="text-xl font-bold text-white mb-4 border-l-4 border-blue-500 pl-3 uppercase tracking-wider">
                    About This Game
                </h3>
                <p className="text-gray-300 leading-7 text-lg max-w-4xl">
                    {displayGame.description || "No detailed description available."}
                </p>
            </div>

            {/* Similar Games */}
            <div className="p-8 bg-[#0f1922] border-t border-gray-800">
                <h3 className="text-xl font-bold text-white mb-6 border-l-4 border-red-500 pl-3 uppercase tracking-wider">
                    More Like This
                </h3>

                {loading ? (
                    <div className="flex gap-4 animate-pulse">
                        {[1,2,3].map(i => <div key={i} className="w-48 h-40 bg-gray-800 rounded-lg"></div>)}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {similarGames.map(sim => (
                            <div key={sim.game_id} className="group cursor-pointer">
                                <div className="h-40 overflow-hidden rounded-lg border border-gray-700 relative">
                                    <img 
                                        src={sim.image} 
                                        className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" 
                                    />
                                </div>
                                <div className="mt-2">
                                    <h4 className="text-sm font-bold text-gray-300 group-hover:text-blue-400 truncate">
                                        {sim.title}
                                    </h4>
                                    <span className="text-xs text-green-500">
                                        {(sim.score * 100).toFixed(0)}% Match
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
      </div>
    </div>
  );
}