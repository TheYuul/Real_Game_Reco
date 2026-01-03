import { useState, useEffect } from "react";

export default function Home({ onStartSurvey, user, onLogout, onLogin }) {
  const [games, setGames] = useState([]);
  const [filteredGames, setFilteredGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAccount, setShowAccount] = useState(false);
  const [accountMode, setAccountMode] = useState("login"); // "login" or "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

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

  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const endpoint = accountMode === "login" ? "/login" : "/register";
    const response = await fetch(`http://127.0.0.1:5000${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (response.ok) {
      onLogin(username);
      setShowAccount(false);
    } else {
      setError(data.error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading games...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="flex justify-between items-center p-6 bg-black bg-opacity-80">
        <h1 className="text-3xl font-bold">GameRecommender</h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="text-white hover:text-gray-300 text-2xl transition"
          >
            🔍
          </button>
          {showSearch && (
            <input
              type="text"
              placeholder="Search games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1 rounded bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          )}
          <button 
            onClick={() => setShowAccount(!showAccount)}
            className="text-white hover:text-gray-300 text-2xl transition"
          >
            👤
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative h-96 bg-gradient-to-r from-purple-900 to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-5xl font-bold mb-4">Discover Your Next Favorite Game</h2>
          <p className="text-xl mb-6">Explore our collection of amazing games</p>
          <button
            onClick={onStartSurvey}
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg text-lg font-semibold transition"
          >
            Start Survey
          </button>
        </div>
      </section>

      {/* Games Grid */}
      <section className="p-6">
        <h3 className="text-2xl font-bold mb-6">All Games</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredGames.map(game => (
            <div
              key={game.game_id}
              className="bg-gray-800 rounded-lg overflow-hidden hover:scale-105 transition-transform cursor-pointer group"
            >
              <div className="overflow-hidden">
                <img
                  src={game.image_url}
                  alt={game.title}
                  className="w-full h-[230px] object-cover group-hover:scale-110 transition-transform"
                  onError={(e) => {
                    e.target.src = "https://placehold.co/300x400/666/fff?text=No+Image";
                  }}
                />
              </div>
              <div className="p-3">
                <h4 className="text-[16px] font-semibold text-sm truncate">{game.title}</h4>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Account Modal */}
      {showAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white text-black p-6 rounded-lg max-w-md w-full mx-4">
            {user ? (
              <div>
                <h3 className="text-lg font-semibold mb-4">Account</h3>
                <p className="mb-4">Logged in as: <strong>{user}</strong></p>
                <button
                  onClick={() => { onLogout(); setShowAccount(false); }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded"
                >
                  Logout
                </button>
                <button
                  onClick={() => setShowAccount(false)}
                  className="w-full mt-2 bg-gray-300 hover:bg-gray-400 text-black py-2 rounded"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="flex mb-4 gap-2">
                  <button
                    onClick={() => setAccountMode("login")}
                    className={`flex-1 py-2 ${accountMode === "login" ? "bg-red-600 text-white" : "bg-gray-200"} rounded-l`}
                  >
                    Login
                  </button>
                  <button
                    onClick={() => setAccountMode("register")}
                    className={`flex-1 py-2 ${accountMode === "register" ? "bg-red-600 text-white" : "bg-gray-200"} rounded-r`}
                  >
                    Register
                  </button>
                </div>
                {error && <p className="text-red-500 mb-4">{error}</p>}
                <form onSubmit={handleAccountSubmit} className="text-white">
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-2 mb-2 border rounded"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2 mb-4 border rounded"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded"
                  >
                    {accountMode === "login" ? "Login" : "Register"}
                  </button>
                </form>
                <button
                  onClick={() => setShowAccount(false)}
                  className="w-full mt-2 bg-gray-300 hover:bg-gray-400 text-black py-2 rounded"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}