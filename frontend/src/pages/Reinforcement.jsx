
import { getReinforcementQuiz, submitQuizAnswer } from "../services/api";
import React, { useState } from "react";

export default function Reinforcement() {
  const [step, setStep] = useState("quiz");
  const [question, setQuestion] = useState(null);
  const [quizId, setQuizId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState("");

  const handleSubmit = async () => {
    if (selected === null || !quizId) return;
    try {
      const res = await submitQuizAnswer(quizId, selected);
      setFeedback(res.feedback || "(No feedback returned)");
    } catch (err) {
      setFeedback("Sorry, there was a problem submitting your answer.");
    }
    setStep("feedback");
  };

  const handleNext = async () => {
    setSelected(null);
    setFeedback("");
    setStep("quiz");
    try {
      const res = await getReinforcementQuiz();
      setQuestion(res.question);
      setQuizId(res.quizId);
    } catch (err) {
      setQuestion(null);
      setQuizId(null);
    }
  };

  // Load first question on mount
  React.useEffect(() => {
    handleNext();
    // eslint-disable-next-line
  }, []);

  return (
    <div className="max-w-xl mx-auto bg-white rounded-lg shadow p-6">
      {step === "quiz" && question && (
        <div>
          <div className="mb-4 font-semibold text-lg">Quiz Time!</div>
          <div className="mb-4">{question.prompt}</div>
          <div className="space-y-2 mb-4">
            {question.options.map((opt, i) => (
              <button
                key={i}
                className={`block w-full text-left px-4 py-2 rounded border transition font-medium ${
                  selected === i
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"
                }`}
                onClick={() => setSelected(i)}
                type="button"
              >
                {opt}
              </button>
            ))}
          </div>
          <button
            className="bg-blue-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-blue-700 transition"
            onClick={handleSubmit}
            disabled={selected === null}
          >
            Submit
          </button>
        </div>
      )}
      {step === "feedback" && (
        <div>
          <div className="mb-4 text-lg font-semibold">{feedback}</div>
          <button
            className="bg-blue-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-blue-700 transition"
            onClick={handleNext}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
