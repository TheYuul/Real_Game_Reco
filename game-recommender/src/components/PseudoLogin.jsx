import { useState } from "react";

export default function PseudoLogin({ onLogin }) {
  const [username, setUsername] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    onLogin(username.trim());
  };

  return (
    <div className="flex justify-center mt-20">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded shadow-md w-80"
      >
        <h2 className="text-xl font-semibold mb-4 text-center">
          Enter Username
        </h2>
        <input
          className="w-full border p-2 mb-4 rounded"
          placeholder="e.g. gamer123"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button className="w-full bg-black text-white py-2 rounded">
          Continue
        </button>
      </form>
    </div>
  );
}
