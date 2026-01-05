import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import GameCard from "./GameCard";
import GameDetailsModal from "./GameDetailsModal"; // Don't forget to import this if you want the modal here too!

export default function Recommendations({ user }) {
  const [recs, setRecs] = useState([]);
  const [status, setStatus] = useState("loading");
  
  // NEW: State for Modal (Optional, if you want the modal to work here too)
  const [selectedGame, setSelectedGame] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const state = location.state || {};
    const guestGenres = state.genres || state.guestGenres;
    const guestPlatforms = state.platforms;
    const guestModes = state.modes;

    if (!user && !guestGenres) {
      navigate("/");
      return;
    }

    const payload = user 
        ? { user_id: user } 
        : { 
            genres: guestGenres,
            platforms: guestPlatforms,
            modes: guestModes
          };

    fetch("http://127.0.0.1:5000/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "cold_start") {
            setStatus("cold_start");
        } else {
            setRecs(data.recommendations || []);
            setStatus("success");
        }
      })
      .catch((err) => {
        console.error(err);
        setStatus("error");
      });
  }, [user, navigate, location.state]);

  const handleRate = async (gameId, newRating) => {
    if (!user) {
        if (window.confirm("You must be logged in to save ratings. Go to login?")) {
            navigate("/");
        }
        return;
    }
    const gameIndex = recs.findIndex(g => g.game_id === gameId);
    if (gameIndex === -1) return;
    const currentGame = recs[gameIndex];
    let isRemoving = false;
    if (newRating === 5 && currentGame.rating >= 4) isRemoving = true;
    if (newRating === 1 && currentGame.rating !== null && currentGame.rating < 4) isRemoving = true;
    const nextRating = isRemoving ? null : newRating;
    const updatedRecs = [...recs];
    updatedRecs[gameIndex] = { ...currentGame, rating: nextRating };
    setRecs(updatedRecs);
    try {
        const endpoint = isRemoving ? "http://127.0.0.1:5000/rate/delete" : "http://127.0.0.1:5000/rate";
        const body = isRemoving ? { user_id: user, game_id: gameId } : { user_id: user, game_id: gameId, rating: newRating };
        await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
    } catch (err) { console.error("Failed to save rating:", err); }
  };

  // NEW: Handler for opening modal (same as Home.jsx)
  const handleGameClick = (game) => {
    setSelectedGame(game);
    setIsModalOpen(true);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-xl text-white animate-pulse">Running algorithm...</div>
      </div>
    );
  }

  if (status === "cold_start") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-4xl font-bold mb-4">We don't know you yet!</h1>
        <p className="text-gray-400 text-xl mb-8 max-w-md">
            We need a little data to start the engine.
        </p>
        <Link 
            to="/survey" 
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-full font-bold text-lg transition transform hover:scale-105 shadow-[0_0_20px_rgba(220,38,38,0.5)]"
        >
            Start the Survey
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
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
        <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
                <h2 className="text-4xl font-bold">Top Picks For You</h2>
                {!user && (
                    <span className="text-xs font-bold px-2 py-1 rounded bg-gray-800 border border-gray-600 text-gray-400 uppercase tracking-widest">
                        Guest Mode
                    </span>
                )}
            </div>
            <p className="text-gray-400">
              {user 
                ? "Curated based on your preferences and play history." 
                : "Curated based on your survey choices."}
            </p>
        </div>

        {/* --- THE FIX: HANDLE EMPTY STATE --- */}
        {recs.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 bg-gray-900/30 rounded-3xl border border-gray-800 border-dashed">
               <div className="text-6xl mb-4">🔍</div>
               <h3 className="text-2xl font-bold text-white mb-2">No Matches Found</h3>
               <p className="text-gray-400 max-w-md text-center mb-8">
                   Your filters (Platform, Genre, Mode) are too strict. We couldn't find any games that match 100% of your criteria.
               </p>
               <Link 
                 to="/survey"
                 className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-full font-bold border border-gray-600 transition-all hover:scale-105"
               >
                 Adjust Filters
               </Link>
           </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {recs.map((game) => (
                <div key={game.game_id} onClick={() => handleGameClick(game)}>
                    <GameCard 
                        {...game} 
                        onRate={handleRate}
                    />
                </div>
            ))}
            </div>
        )}
      </div>

      {/* Modal Integration */}
      <GameDetailsModal 
          game={selectedGame} 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          user={user}
      />
    </div>
  );
}