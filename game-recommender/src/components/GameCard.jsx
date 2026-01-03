import { useState } from "react";

export default function GameCard({ game_id, title, score, image, feedback: initialFeedback, onRate, explanation }) {
  const [feedback, setFeedback] = useState(initialFeedback || null); // null, 'like', 'dislike'
  const [confirming, setConfirming] = useState(null); // null, 'like', 'dislike'

  // Handle initial click (first step)
  const handleClick = (type) => {
    if (feedback === type) {
      // Undo action
      setFeedback(null);
      onRate(game_id, null); // optional: send undo to backend
      return;
    }

    // Start confirmation step
    setConfirming(type);
  };

  // Confirm button click
  const handleConfirm = () => {
    setFeedback(confirming);
    setConfirming(null);
    onRate(game_id, confirming === "like" ? 5 : 1);
  };

  // Cancel confirmation
  const handleCancel = () => {
    setConfirming(null);
  };

  return (
    <div className="flex flex-col bg-gray-50 p-6 rounded shadow-sm min-h-80">
      <div className="w-82 h-[250px] mb-3 mx-auto overflow-hidden rounded">
        {image ? (
          <img src={image} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gray-300 flex items-center justify-center">
            <span className="text-xs">No Image</span>
          </div>
        )}
      </div>

      <div className="flex-1 text-center">
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-base text-gray-600">Match Score: {(score * 100).toFixed(0)}%</p>
        <p className="text-sm text-gray-500 mt-1">{explanation}</p>

        <div className="mt-2 flex gap-2 justify-center">
          {confirming === "like" ? (
            <>
              <button
                onClick={handleConfirm}
                className="px-2 py-1 text-sm bg-green-600 text-white rounded"
              >
                Confirm Like
              </button>
              <button
                onClick={handleCancel}
                className="px-2 py-1 text-sm bg-gray-400 rounded"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => handleClick("like")}
              className={`px-2 py-1 text-sm rounded ${
                feedback === "like" ? "bg-green-500 text-white" : "bg-gray-400"
              }`}
            >
              👍 {feedback === "like" ? "Liked ✓" : "Like"}
            </button>
          )}

          {confirming === "dislike" ? (
            <>
              <button
                onClick={handleConfirm}
                className="px-2 py-1 text-sm bg-red-600 text-white rounded"
              >
                Confirm Dislike
              </button>
              <button
                onClick={handleCancel}
                className="px-2 py-1 text-sm bg-gray-400 rounded"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => handleClick("dislike")}
              className={`px-2 py-1 text-sm rounded ${
                feedback === "dislike" ? "bg-red-500 text-white" : "bg-gray-400"
              }`}
            >
              👎 {feedback === "dislike" ? "Disliked ✕" : "Dislike"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
