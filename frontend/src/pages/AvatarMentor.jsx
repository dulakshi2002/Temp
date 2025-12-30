
import { sendAvatarMentorMessage } from "../services/api";
import React, { useState } from "react";

export default function AvatarMentor() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      sender: "avatar",
      text: "Hello! I'm your Mentor. Ask me anything about your studies.",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = React.useRef(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    setError("");
    const userMsg = {
      sender: "user",
      text: input,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages((msgs) => [...msgs, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await sendAvatarMentorMessage(userMsg.text);
      setMessages((msgs) => [
        ...msgs,
        {
          sender: "avatar",
          text: res.reply || "(No response)",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
      ]);
    } catch {
      setMessages((msgs) => [
        ...msgs,
        {
          sender: "avatar",
          text: "Sorry, there was a problem connecting to the Mentor service.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
      ]);
      setError("Connection error. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-0 flex flex-col h-[80vh] border border-gray-100 mt-4">
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-blue-100 rounded-t-2xl">
        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl font-bold shadow">AV</div>
        <div className="font-semibold text-lg text-blue-700">Avatar Mentor</div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50">
        {/* Avatar placeholder */}
        <div className="flex justify-center mb-4">
          <div className="w-24 h-24 rounded-full bg-blue-200 flex items-center justify-center text-4xl font-bold text-blue-700 shadow">
            🧑‍🏫
          </div>
        </div>
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
            {msg.sender === "avatar" && (
              <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold">🤖</div>
            )}
            <div
              className={`px-4 py-2 rounded-2xl max-w-[70%] text-sm shadow-sm relative ${
                msg.sender === "user"
                  ? "bg-blue-500 text-white rounded-br-none"
                  : "bg-white text-gray-800 border border-blue-100 rounded-bl-none"
              }`}
              aria-label={msg.sender === "user" ? "Your message" : "Mentor reply"}
            >
              {msg.text}
              <span className="block text-xs text-gray-400 mt-1 text-right">{msg.time}</span>
            </div>
            {msg.sender === "user" && (
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">🧑</div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-end gap-2 justify-start">
            <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold">🤖</div>
            <div className="px-4 py-2 rounded-2xl max-w-[70%] text-sm shadow-sm bg-white text-gray-800 border border-blue-100 rounded-bl-none animate-pulse">
              <span className="text-blue-400">Mentor is typing...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} className="flex gap-2 p-4 border-t bg-white rounded-b-2xl">
        <input
          className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          aria-label="Type your message"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-blue-700 transition disabled:opacity-60"
          disabled={loading || !input.trim()}
          aria-label="Send message"
        >
          {loading ? "..." : "Send"}
        </button>
      </form>
      {error && (
        <div className="text-red-500 text-center py-2 text-sm bg-red-50 border-t border-red-200">{error}</div>
      )}
    </div>
  );
}
