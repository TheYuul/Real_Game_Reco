import React from "react";

export default function GameCard({ game_id, title, score, image, explanation, rating, onRate }) {
  
  // Helper to handle the rating while stopping the modal from opening
  const handleAction = (e, rateValue) => {
    e.stopPropagation(); // This prevents the click from reaching the parent div
    onRate(game_id, rateValue);
  };

  return (
    <div className="group relative bg-gray-900 rounded-xl overflow-hidden hover:shadow-[0_0_25px_rgba(220,38,38,0.15)] hover:-translate-y-1 transition-all duration-300 flex flex-col h-full transform-gpu isolate cursor-pointer">
      
      {/* THE FIX: Webkit Mask Image */}
      <div 
        className="w-full h-[200px] relative overflow-hidden bg-gray-900"
        style={{ WebkitMaskImage: "-webkit-radial-gradient(white, black)" }} 
      >
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 backface-hidden"
          onError={(e) => e.target.src = "https://placehold.co/400x225/333/fff?text=No+Image"}
        />
        
        {/* Score Badge */}
        <div className="absolute top-2 right-2 bg-black/80 backdrop-blur text-green-400 text-xs font-bold px-2 py-1 rounded border border-green-600/50 shadow-lg z-20">
           {(score * 100).toFixed(0)}% Match
        </div>
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-90 z-10 pointer-events-none"></div>
      </div>

      {/* Content Section */}
      <div className="p-5 flex-1 flex flex-col relative z-20">
        <h3 className="font-bold text-xl text-white mb-2 leading-tight drop-shadow-md truncate" title={title}>
            {title}
        </h3>
        
        <p className="text-sm text-gray-400 mb-6 line-clamp-2 leading-relaxed">
            {explanation || "Recommended based on your taste profile."}
        </p>

        {/* Buttons Section */}
        <div className="flex gap-2 mt-auto">
          <button
            onClick={(e) => handleAction(e, 5)} // Use helper to stop propagation
            className={`flex-1 py-2 rounded-lg font-bold transition text-sm flex items-center justify-center gap-2 cursor-pointer ${
              rating >= 4 
                ? "bg-green-600 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)] ring-1 ring-green-400" 
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
            }`}
          >
            👍 Like
          </button>
          
          <button
            onClick={(e) => handleAction(e, 1)} // Use helper to stop propagation
            className={`flex-1 py-2 rounded-lg font-bold transition text-sm flex items-center justify-center gap-2 cursor-pointer ${
              rating && rating < 4 
                ? "bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.4)] ring-1 ring-red-400" 
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
            }`}
          >
            👎 Dislike
          </button>
        </div>
      </div>

      {/* THE BORDER OVERLAY */}
      <div className="absolute inset-0 rounded-xl border border-gray-800 pointer-events-none group-hover:border-red-500/50 transition-colors duration-300 z-50"></div>

    </div>
  );
}