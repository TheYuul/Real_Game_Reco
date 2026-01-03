import { useState } from "react";
import Home from "./components/Home";
import LoginRegister from "./components/LoginRegister";
import Survey from "./components/Survey";
import Recommendations from "./components/Recommendations";

function App() {
  const [showHome, setShowHome] = useState(true);
  const [user, setUser] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [feedback, setFeedback] = useState({});

  const handleSurveySubmit = async (prefs) => {
    const res = await fetch("http://127.0.0.1:5000/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user,
        preferences: prefs
      }),
    });

    const data = await res.json();

    const maxScore = Math.max(...data.recommendations.map(g => g.score || 1));

    const gamesWithScore = data.recommendations.map(g => ({
      game_id: g.game_id,
      title: g.title,
      score: (g.score || 1) / maxScore,
      image: g.image,
      rating: g.rating,
      explanation: g.explanation
    }));

    setRecommendations(gamesWithScore);

    // Set initial feedback based on existing ratings
    const initialFeedback = {};
    gamesWithScore.forEach(g => {
      if (g.rating !== null) {
        initialFeedback[g.game_id] = g.rating >= 4 ? "like" : "dislike";
      }
    });
    setFeedback(initialFeedback);
  };

  const handleRate = (gameId, rating) => {
    setFeedback(prev => ({ ...prev, [gameId]: rating === null ? undefined : (rating >= 4 ? "like" : "dislike") }));

    // Optional: send to backend if rating !== null
    if (rating !== null) {
      fetch("http://127.0.0.1:5000/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user, game_id: gameId, rating }),
      });
    }
  };


  if (showHome) return <Home onStartSurvey={() => setShowHome(false)} user={user} onLogout={() => setUser(null)} onLogin={setUser} />;

  if (!user) return <LoginRegister onLogin={setUser} onClose={() => setShowHome(true)} />;

  return (
    <div className="min-h-screen p-8 bg-black">
      <h1 className="text-3xl font-bold mb-6 text-center">
        GameRecommender
      </h1>

      {!recommendations.length && <Survey onSubmit={handleSurveySubmit} />}
      
      {recommendations.length > 0 && (
        <Recommendations
          games={recommendations}
          user={user}
          feedback={feedback}
          handleRate={handleRate}
          onGoHome={() => { setRecommendations([]); setShowHome(true); }}
        />
      )}
    </div>
  );
}

export default App;
