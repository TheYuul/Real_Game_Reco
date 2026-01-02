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
    <div className="mt-8 max-w-lg mx-auto bg-white p-6 rounded shadow-md space-y-3">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Recommended Games</h2>
        <button
          onClick={onGoHome}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
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
