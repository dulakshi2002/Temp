
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

  const handleExplain = async (e) => {
    e.preventDefault();
    if (!concept.trim()) return;
    setLoading(true);
    setExplanation("");
    try {
      const res = await getExplanation(concept, mode);
      setExplanation(res.explanation || "(No explanation returned)");
    } catch (err) {
      setExplanation("Sorry, there was a problem connecting to the explanation service.");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
      <form onSubmit={handleExplain} className="flex gap-2 mb-4">
        <input
          className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Enter a concept or topic..."
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-blue-700 transition"
        >
          Explain
        </button>
      </form>
      <div className="flex gap-2 mb-4">
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
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="min-h-[80px] bg-gray-50 rounded p-4 text-gray-800">
        {loading ? <span className="text-blue-500">Generating explanation...</span> : explanation}
      </div>
    </div>
  );
}
