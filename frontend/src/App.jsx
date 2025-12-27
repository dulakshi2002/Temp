import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import StudyBuddy from "./pages/StudyBuddy";
import Explanations from "./pages/Explanations";
import Reinforcement from "./pages/Reinforcement";
import AvatarMentor from "./pages/AvatarMentor";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100">
        <nav className="bg-white/90 shadow-lg mb-8 sticky top-0 z-20 border-b border-blue-100 backdrop-blur">
          <div className="container mx-auto px-4 py-3 flex items-center gap-8">
            <NavLink to="/" className="flex items-center gap-2 group" end>
              <span className="inline-block w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-lg shadow">EM</span>
              <span className="font-extrabold text-xl text-blue-700 tracking-tight group-hover:text-blue-900 transition">EduMentor</span>
            </NavLink>
            <div className="flex gap-4 ml-8">
              <NavLink to="/study-buddy" className={({isActive}) => `px-3 py-1.5 rounded-full font-medium transition ${isActive ? 'bg-blue-600 text-white shadow' : 'text-blue-700 hover:bg-blue-100'}`}>Study Buddy</NavLink>
              <NavLink to="/explanations" className={({isActive}) => `px-3 py-1.5 rounded-full font-medium transition ${isActive ? 'bg-blue-600 text-white shadow' : 'text-blue-700 hover:bg-blue-100'}`}>Explanations</NavLink>
              <NavLink to="/avatar-mentor" className={({isActive}) => `px-3 py-1.5 rounded-full font-medium transition ${isActive ? 'bg-blue-600 text-white shadow' : 'text-blue-700 hover:bg-blue-100'}`}>Avatar Mentor</NavLink>
              <NavLink to="/reinforcement" className={({isActive}) => `px-3 py-1.5 rounded-full font-medium transition ${isActive ? 'bg-blue-600 text-white shadow' : 'text-blue-700 hover:bg-blue-100'}`}>Reinforcement</NavLink>
            </div>
          </div>
        </nav>
        <main className="container mx-auto px-4 pb-8">
          <Routes>
            <Route path="/" element={<div className="text-2xl font-semibold">Welcome to EduMentor</div>} />
            <Route path="/study-buddy" element={<StudyBuddy />} />
            <Route path="/explanations" element={<Explanations />} />
            <Route path="/avatar-mentor" element={<AvatarMentor />} />
            <Route path="/reinforcement" element={<Reinforcement />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
