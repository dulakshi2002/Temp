
import { getExplanation } from "../services/api";
import React, { useState } from "react";

const explanationModes = [
  { key: "visual", label: "Visual" },
  { key: "metaphor", label: "Metaphor" },
  { key: "code", label: "Code" },
  { key: "simple", label: "Simple" },
];

export default function Explanations() {
  const [mode, setMode] = useState("visual");
  const [concept, setConcept] = useState("");
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleExplain = async (e) => {
    e.preventDefault();
    if (!concept.trim()) return;
    setError("");
    setLoading(true);
    setExplanation("");
    try {
      const res = await getExplanation(concept, mode);
      setExplanation(res.explanation || "(No explanation returned)");
    } catch {
      setExplanation("");
      setError("Sorry, there was a problem connecting to the explanation service.");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg border border-gray-100 p-0 flex flex-col mt-4">
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-blue-100 rounded-t-2xl">
        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl font-bold shadow">EX</div>
        <div className="font-semibold text-lg text-blue-700">Multi-View Explanations</div>
      </div>
      <form onSubmit={handleExplain} className="flex gap-2 px-6 py-4 border-b bg-white">
        <input
          className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
          placeholder="Enter a concept or topic..."
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-blue-700 transition disabled:opacity-60"
          disabled={loading || !concept.trim()}
        >
          {loading ? "..." : "Explain"}
        </button>
      </form>
      <div className="flex gap-2 px-6 py-2 border-b bg-white">
        {explanationModes.map((m) => (
          <button
            key={m.key}
            className={`px-4 py-2 rounded-full border font-medium transition text-sm ${
              mode === m.key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"
            }`}
            onClick={() => setMode(m.key)}
            type="button"
            disabled={loading}
            aria-label={`Show ${m.label} explanation`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="min-h-[120px] bg-gray-50 rounded-b-2xl p-6 text-gray-800 flex items-center justify-center text-center text-lg relative">
        {loading && <span className="text-blue-500 animate-pulse">Generating explanation...</span>}
        {!loading && explanation && (
          <span className="block w-full text-gray-800 whitespace-pre-line">{explanation}</span>
        )}
        {!loading && error && (
          <span className="block w-full text-red-500 bg-red-50 border border-red-200 rounded p-2">{error}</span>
        )}
      </div>
    </div>
  );
}
