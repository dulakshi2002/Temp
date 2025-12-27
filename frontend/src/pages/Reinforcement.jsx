
import { getReinforcementQuiz, submitQuizAnswer } from "../services/api";
import React, { useState } from "react";

export default function Reinforcement() {
  const [step, setStep] = useState("quiz");
  const [question, setQuestion] = useState(null);
  const [quizId, setQuizId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (selected === null || !quizId) return;
    setLoading(true);
    setError("");
    try {
      const res = await submitQuizAnswer(quizId, selected);
      setFeedback(res.feedback || "(No feedback returned)");
    } catch {
      setFeedback("");
      setError("Sorry, there was a problem submitting your answer.");
    }
    setStep("feedback");
    setLoading(false);
  };

  const handleNext = async () => {
    setSelected(null);
    setFeedback("");
    setStep("quiz");
    setLoading(true);
    setError("");
    try {
      const res = await getReinforcementQuiz();
      setQuestion(res.question);
      setQuizId(res.quizId);
    } catch {
      setQuestion(null);
      setQuizId(null);
      setError("Sorry, there was a problem loading the quiz.");
    }
    setLoading(false);
  };

  // Load first question on mount
  React.useEffect(() => {
    handleNext();
    // eslint-disable-next-line
  }, []);

  return (
    <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-lg border border-gray-100 p-0 flex flex-col mt-4">
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-blue-100 rounded-t-2xl">
        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl font-bold shadow">QZ</div>
        <div className="font-semibold text-lg text-blue-700">Adaptive Reinforcement</div>
      </div>
      <div className="px-6 py-6 flex-1">
        {loading && (
          <div className="flex items-center justify-center min-h-[120px]">
            <span className="text-blue-500 animate-pulse">Loading...</span>
          </div>
        )}
        {!loading && error && (
          <div className="text-red-500 text-center py-2 text-sm bg-red-50 border border-red-200 rounded mb-4">{error}</div>
        )}
        {!loading && step === "quiz" && question && (
          <div>
            <div className="mb-4 font-semibold text-lg">Quiz Time!</div>
            <div className="mb-4 text-gray-800 text-base">{question.prompt}</div>
            <div className="space-y-2 mb-4">
              {question.options.map((opt, i) => (
                <button
                  key={i}
                  className={`block w-full text-left px-4 py-2 rounded-full border transition font-medium ${
                    selected === i
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"
                  }`}
                  onClick={() => setSelected(i)}
                  type="button"
                  disabled={loading}
                  aria-label={`Select answer ${i + 1}`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <button
              className="bg-blue-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-blue-700 transition disabled:opacity-60"
              onClick={handleSubmit}
              disabled={selected === null || loading}
              aria-label="Submit answer"
            >
              {loading ? "..." : "Submit"}
            </button>
          </div>
        )}
        {!loading && step === "feedback" && (
          <div className="flex flex-col items-center justify-center min-h-[120px]">
            <div className="mb-4 text-lg font-semibold text-blue-700">{feedback}</div>
            <button
              className="bg-blue-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-blue-700 transition"
              onClick={handleNext}
              aria-label="Next question"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
