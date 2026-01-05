import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

function History({ user }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    fetchHistory();
  }, [user, navigate]);

  const fetchHistory = () => {
    fetch(`http://127.0.0.1:5000/user/history/${user}`)
      .then((res) => res.json())
      .then((data) => {
        setHistory(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading history:", err);
        setLoading(false);
      });
  };

  const handleRate = async (gameId, newRating) => {
    // Optimistic Update
    setHistory(prev => prev.map(game => 
      game.game_id === gameId 
        ? { ...game, rating: newRating, status: newRating >= 4 ? "Liked" : "Disliked" } 
        : game
    ));

    try {
      await fetch("http://127.0.0.1:5000/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user,
          game_id: gameId,
          rating: newRating,
        }),
      });
    } catch (error) {
      console.error("Failed to update rating", error);
      fetchHistory(); 
    }
  };

  const handleRemove = async (gameId) => {
    if (!window.confirm("Remove this game from your history?")) return;

    setHistory(prev => prev.filter(game => game.game_id !== gameId));

    try {
      await fetch("http://127.0.0.1:5000/rate/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user,
          game_id: gameId,
        }),
      });
    } catch (error) {
      console.error("Failed to delete rating", error);
      fetchHistory(); 
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white animate-pulse">
        Loading history...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
        
      {/* 1. HEADER (Matches Home/Recs) */}
      <header className="flex justify-between items-center p-6 sticky top-0 z-40 border-b border-gray-800 backdrop-blur-md bg-black/70">
        <h1 className="text-3xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 pr-2">
            GameRecommender
        </h1>
        <Link
            to="/"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition group"
        >
            <span className="text-sm font-bold group-hover:text-red-500 transition-colors">← Back to Library</span>
        </Link>
      </header>

      <div className="max-w-7xl mx-auto p-8">
        {/* Page Title */}
        <div className="flex items-center gap-4 mb-10">
            <div className="h-10 w-2 bg-blue-600 rounded-full"></div>
            <div>
                <h2 className="text-4xl font-bold">Rating History</h2>
                <p className="text-gray-400 mt-1">Manage your rated games to improve your recommendations.</p>
            </div>
        </div>

        {/* Empty State */}
        {history.length === 0 ? (
          <div className="text-center py-20 bg-gray-900/50 rounded-2xl border border-gray-800">
            <p className="text-3xl font-bold text-gray-700 mb-4">No ratings yet.</p>
            <Link to="/" className="inline-block bg-blue-600 px-8 py-3 rounded-full font-bold hover:bg-blue-700 transition shadow-lg hover:shadow-blue-500/20">
              Go Rate Games
            </Link>
          </div>
        ) : (
          /* 2. GRID LAYOUT (Matches Home - 3 Columns) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {history.map((game) => (
              
              /* 3. CARD COMPONENT (Flicker-Free Version) */
              <div 
                key={game.game_id} 
                className="group relative bg-gray-900 rounded-xl overflow-hidden hover:-translate-y-1 transition-all duration-300 flex flex-col h-full transform-gpu isolate hover:shadow-[0_0_25px_rgba(59,130,246,0.2)]"
              >
                {/* Delete Button (Floating) */}
                <button
                  onClick={() => handleRemove(game.game_id)}
                  className="absolute top-2 right-2 z-50 bg-black/60 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 border border-white/10"
                  title="Remove from history"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Image Area with Masking Fix */}
                <div 
                    className="w-full h-[200px] relative overflow-hidden bg-gray-900"
                    style={{ WebkitMaskImage: "-webkit-radial-gradient(white, black)" }}
                >
                   <img 
                    src={game.image} 
                    alt={game.title} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 backface-hidden"
                    onError={(e) => e.target.src = "https://placehold.co/400x225/333/fff?text=No+Image"}
                  />
                  
                  {/* Status Badge */}
                  <div className={`absolute top-2 left-2 px-3 py-1 rounded-full text-xs font-bold shadow-lg z-20 border backdrop-blur-md ${
                     game.rating >= 4 
                        ? "bg-green-500/20 border-green-500 text-green-400" 
                        : "bg-red-500/20 border-red-500 text-red-400"
                  }`}>
                     {game.rating >= 4 ? "Liked" : "Disliked"}
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-90 z-10 pointer-events-none"></div>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col relative z-20">
                  <h4 className="font-bold text-xl text-white mb-4 truncate" title={game.title}>
                    {game.title}
                  </h4>

                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => handleRate(game.game_id, 5)}
                      className={`flex-1 py-2 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 ${
                        game.rating >= 4 
                          ? "bg-green-600 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)] ring-1 ring-green-400" 
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
                      }`}
                    >
                      👍 Like
                    </button>
                    <button
                      onClick={() => handleRate(game.game_id, 1)}
                      className={`flex-1 py-2 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 ${
                        game.rating < 4 
                          ? "bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.4)] ring-1 ring-red-400" 
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
                      }`}
                    >
                      👎 Dislike
                    </button>
                  </div>
                </div>

                {/* Border Overlay (Fixes Pixel Fighting) */}
                <div className="absolute inset-0 rounded-xl border border-gray-800 pointer-events-none group-hover:border-blue-500/50 transition-colors duration-300 z-50"></div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default History;