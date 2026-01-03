import { useState } from "react";

const features = [
  { key: "singleplayer", label: "Singleplayer", desc: "Games you play alone, focusing on personal experience", icon: "👤" },
  { key: "multiplayer", label: "Multiplayer", desc: "Games with online or local co-op/multiplayer modes", icon: "👥" },
  { key: "story", label: "Story-Driven", desc: "Games with strong narratives and character development", icon: "📖" },
  { key: "competitive", label: "Competitive", desc: "Games emphasizing skill-based competition and rankings", icon: "🏆" },
  { key: "rpg", label: "RPG", desc: "Role-playing games with character progression and quests", icon: "⚔️" },
  { key: "shooter", label: "Shooter", desc: "First-person or action shooters with combat focus", icon: "🔫" },
  { key: "open_world", label: "Open World", desc: "Games with large explorable environments and freedom", icon: "🌍" },
  { key: "casual", label: "Casual", desc: "Easy-to-pick-up games for short sessions", icon: "🎮" },
  { key: "survival", label: "Survival", desc: "Games involving resource management and survival challenges", icon: "🏕️" }
];

export default function Survey({ onSubmit }) {
  const [prefs, setPrefs] = useState(Object.fromEntries(features.map(f => [f.key, 3])));

  const handleChange = (feature, value) => {
    setPrefs(prev => ({ ...prev, [feature]: parseInt(value) }));
  };

  const handleReset = () => {
    setPrefs(Object.fromEntries(features.map(f => [f.key, 3])));
  };

  const getLabel = (value) => {
    if (value === 1) return "Dislike";
    if (value === 2) return "Somewhat Dislike";
    if (value === 3) return "Neutral";
    if (value === 4) return "Somewhat Like";
    if (value === 5) return "Love";
  };

  return (
    <div className="bg-gradient-to-r from-purple-900 to-blue-900 p-8 rounded-xl shadow-lg max-w-2xl mx-auto outline outline-offset-4">
      <h2 className="text-2xl font-bold mb-2 text-center text-white">Rate Your Game Preferences</h2>
      <p className="text-sm text-white mb-6 text-center">Slide the bars to indicate how much you like each type of game feature.</p>
      <div className="space-y-6">
        {features.map(f => (
          <div key={f.key} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="mb-1 flex items-center">
              <span className="text-2xl mr-3">{f.icon}</span>
              <label className="font-semibold text-gray-800">{f.label}</label>
            </div>
            <div className="mb-2">
              <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full">{getLabel(prefs[f.key])}</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">{f.desc}</p>
            <input
              type="range"
              min="1"
              max="5"
              value={prefs[f.key]}
              onChange={(e) => handleChange(f.key, e.target.value)}
              className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb"
            />
            <div className="text-xs text-gray-400 mt-2 text-center">
              1 - Dislike &nbsp;&nbsp;&nbsp; 3 - Neutral &nbsp;&nbsp;&nbsp; 5 - Love
            </div>
          </div>
        ))}
      </div>
      <div className="flex space-x-4 mt-8">
        <button
          onClick={() => onSubmit(prefs)}
          className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all font-medium shadow-md"
        >
          Get Recommendations
        </button>
        <button
          onClick={handleReset}
          className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-all font-medium"
        >
          Reset All
        </button>
      </div>
    </div>
  );
}
