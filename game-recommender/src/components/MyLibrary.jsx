import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function MyLibrary({ user }) {
  const [library, setLibrary] = useState([]);
  const [filter, setFilter] = useState("All"); // "All", "Playing", "Completed", etc.
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
        navigate("/");
        return;
    }
    fetch(`http://127.0.0.1:5000/library/${user}`)
        .then(res => res.json())
        .then(data => {
            setLibrary(data);
            setLoading(false);
        })
        .catch(err => {
            console.error(err);
            setLoading(false);
        });
  }, [user, navigate]);

  // Filter Logic
  const filteredGames = filter === "All" 
    ? library 
    : library.filter(g => g.status === filter);

  const stats = {
      all: library.length,
      playing: library.filter(g => g.status === "Playing").length,
      completed: library.filter(g => g.status === "Completed").length,
      planned: library.filter(g => g.status === "Plan to Play").length,
      dropped: library.filter(g => g.status === "Dropped").length,
  };

  const getStatusColor = (status) => {
      switch(status) {
          case "Playing": return "text-green-400 border-green-500/50 bg-green-500/10";
          case "Completed": return "text-blue-400 border-blue-500/50 bg-blue-500/10";
          case "Dropped": return "text-red-400 border-red-500/50 bg-red-500/10";
          case "Plan to Play": return "text-gray-400 border-gray-500/50 bg-gray-500/10";
          default: return "text-gray-500";
      }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
        
      {/* HEADER */}
      <header className="flex justify-between items-center p-6 sticky top-0 z-40 border-b border-gray-800 backdrop-blur-md bg-black/70">
        <h1 className="text-3xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 pr-2">
          GameRecommender
        </h1>
        <Link to="/" className="text-gray-400 hover:text-white transition">← Back to Home</Link>
      </header>

      <div className="max-w-7xl mx-auto p-8">
          
          {/* PROFILE HEADER */}
          <div className="flex flex-col md:flex-row items-end justify-between gap-6 mb-10 border-b border-gray-800 pb-8">
              <div>
                  <h2 className="text-4xl font-bold mb-2">My Collection</h2>
                  <p className="text-gray-400">Track, rate, and organize your gaming journey.</p>
              </div>
              
              {/* STATS ROW */}
              <div className="flex gap-4 text-sm font-bold">
                  <div className="text-center px-4">
                      <div className="text-2xl text-white">{stats.all}</div>
                      <div className="text-gray-500">Total</div>
                  </div>
                  <div className="text-center px-4 border-l border-gray-800">
                      <div className="text-2xl text-green-500">{stats.playing}</div>
                      <div className="text-gray-500">Playing</div>
                  </div>
                  <div className="text-center px-4 border-l border-gray-800">
                      <div className="text-2xl text-blue-500">{stats.completed}</div>
                      <div className="text-gray-500">Done</div>
                  </div>
              </div>
          </div>

          {/* TABS */}
          <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
              {["All", "Playing", "Completed", "Plan to Play", "Dropped"].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setFilter(tab)}
                    className={`px-6 py-2 rounded-full font-bold whitespace-nowrap transition-all border
                        ${filter === tab 
                            ? "bg-white text-black border-white" 
                            : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500 hover:text-white"
                        }`}
                  >
                      {tab}
                  </button>
              ))}
          </div>

          {/* LIST VIEW */}
          {loading ? (
              <div className="text-center py-20 text-gray-500 animate-pulse">Loading library...</div>
          ) : filteredGames.length === 0 ? (
              <div className="text-center py-20 bg-gray-900/30 rounded-xl border border-dashed border-gray-800">
                  <p className="text-xl text-gray-500">No games found in "{filter}"</p>
                  <Link to="/" className="text-blue-500 hover:underline mt-2 inline-block">Find games to add</Link>
              </div>
          ) : (
              <div className="grid gap-4">
                  {filteredGames.map(game => (
                      <div key={game.game_id} className="flex items-center gap-4 bg-[#121212] p-4 rounded-xl border border-gray-800 hover:border-gray-600 transition group">
                          
                          {/* Image */}
                          <div className="h-24 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-800">
                              <img src={game.image} className="h-full w-full object-cover group-hover:scale-110 transition duration-500" />
                          </div>

                          {/* Info */}
                          <div className="flex-1">
                              <h3 className="font-bold text-lg text-white group-hover:text-blue-400 transition">{game.title}</h3>
                              <div className="flex items-center gap-3 mt-2">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getStatusColor(game.status)}`}>
                                      {game.status}
                                  </span>
                                  <span className="text-xs text-gray-500">Added: {game.date}</span>
                              </div>
                          </div>

                          {/* Action (Optional Edit Button) */}
                          <button className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition">
                              Edit
                          </button>
                      </div>
                  ))}
              </div>
          )}
      </div>
    </div>
  );
}