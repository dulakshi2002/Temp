import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import StudyBuddy from "./pages/StudyBuddy";
import Explanations from "./pages/Explanations";
import Reinforcement from "./pages/Reinforcement";
import AvatarMentor from "./pages/AvatarMentor";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow mb-6">
          <div className="container mx-auto px-4 py-4 flex gap-6">
            <Link to="/" className="font-bold text-blue-600">EduMentor</Link>
            <Link to="/study-buddy" className="hover:text-blue-600">Study Buddy</Link>
            <Link to="/explanations" className="hover:text-blue-600">Explanations</Link>
            <Link to="/avatar-mentor" className="hover:text-blue-600">Avatar Mentor</Link>
            <Link to="/reinforcement" className="hover:text-blue-600">Reinforcement</Link>
          </div>
        </nav>
        <main className="container mx-auto px-4">
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
