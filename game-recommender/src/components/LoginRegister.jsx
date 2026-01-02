import { useState } from "react";

export default function LoginRegister({ onLogin, onClose }) {
  const [accountMode, setAccountMode] = useState("login"); // "login" or "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

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
    } else {
      setError(data.error);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="bg-white text-black p-6 rounded-lg max-w-md w-full mx-4">
        <div className="flex mb-4">
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
        <form onSubmit={handleAccountSubmit}>
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
          onClick={onClose}
          className="w-full mt-2 bg-gray-300 hover:bg-gray-400 text-black py-2 rounded"
        >
          Close
        </button>
      </div>
    </div>
  );
}