import GameCard from "./GameCard";

export default function Recommendations({ games, user, feedback, handleRate, onGoHome }) {
  const rateGame = async (gameId, rating) => {
    await fetch("http://127.0.0.1:5000/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user,
        game_id: gameId,
        rating: rating
      }),
    });
  };

  return (
    <div className="relative mt-8 max-w-lg mx-auto bg-gradient-to-r from-purple-900 to-blue-900 p-6 pb-20 rounded shadow-md space-y-3">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-white text-xl font-semibold">Recommended Games</h2>
        <button
          onClick={onGoHome}
          className="absolute bg-blue-500 text-white bottom-0 left-1/2 -translate-x-1/2 mb-5 px-4 py-2 rounded hover:bg-blue-600 transition"
        >
          Done
        </button>
      </div>

      {games.map((g) => (
        <GameCard
          key={g.game_id}
          game_id={g.game_id}
          title={g.title}
          score={g.score}
          image={g.image}
          feedback={feedback[g.game_id] || null}
          onRate={handleRate}
          explanation={g.explanation}
        />
      ))}
    </div>
  );
}
