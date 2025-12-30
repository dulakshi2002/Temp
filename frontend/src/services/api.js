import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000/api";

export const sendStudyBuddyMessage = async (message) => {
  // Example: POST /api/ace/study-buddy
  const res = await axios.post(`${API_BASE}/ace/study-buddy`, { message });
  return res.data;
};

export const getExplanation = async (concept, mode) => {
  // Example: POST /api/ace/explanation
  const res = await axios.post(`${API_BASE}/ace/explanation`, { concept, mode });
  return res.data;
};

export const getReinforcementQuiz = async () => {
  // Example: GET /api/ace/quiz
  const res = await axios.get(`${API_BASE}/ace/quiz`);
  return res.data;
};

export const submitQuizAnswer = async (quizId, answer) => {
  // Example: POST /api/ace/quiz/submit
  const res = await axios.post(`${API_BASE}/ace/quiz/submit`, { quizId, answer });
  return res.data;
};

export const sendAvatarMentorMessage = async (message) => {
  // Example: POST /api/ace/avatar-mentor
  const res = await axios.post(`${API_BASE}/ace/avatar-mentor`, { message });
  return res.data;
};
