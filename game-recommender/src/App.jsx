import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./components/Home";
import Survey from "./components/Survey";
import Recommendations from "./components/Recommendations";
import History from "./components/History";
import MyLibrary from "./components/MyLibrary";
import Profile from "./components/Profile";

function App() {
  const [user, setUser] = useState(null);

  return (
    <div className="min-h-screen bg-black text-white">
      <Routes>
        {/* Home Route */}
        <Route 
          path="/" 
          element={
            <Home 
              user={user} 
              onLogin={setUser} 
              onLogout={() => setUser(null)} 
            />
          } 
        />

        {/* Survey Route */}
        <Route 
          path="/survey" 
          element={<Survey user={user} />} 
        />

        {/* Recommendations Route */}
        <Route 
          path="/recommendations" 
          element={<Recommendations user={user} />} 
        />

        <Route 
          path="/history" 
          element={<History user={user} />} />

        <Route path="/survey" 
        element={<Survey user={user} />} />

        <Route path="/library" 
        element={<MyLibrary user={user} />} />

        <Route path="/profile" 
        element={<Profile user={user} />} />

        {/* Catch-all: Redirect to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;