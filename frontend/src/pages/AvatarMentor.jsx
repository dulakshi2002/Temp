
import { sendAvatarMentorMessage } from "../services/api";
import React, { useState } from "react";

export default function AvatarMentor() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { sender: "avatar", text: "Hello! I'm your Mentor. Ask me anything about your studies." },
  ]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages((msgs) => [
      ...msgs,
      { sender: "user", text: input },
    ]);
    setInput("");
    try {
      const res = await sendAvatarMentorMessage(input);
      setMessages((msgs) => [
        ...msgs,
        { sender: "avatar", text: res.reply || "(No response)" },
      ]);
    } catch (err) {
      setMessages((msgs) => [
        ...msgs,
        { sender: "avatar", text: "Sorry, there was a problem connecting to the Mentor service." },
      ]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6 flex flex-col h-[70vh]">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {/* Avatar placeholder */}
        <div className="flex justify-center mb-4">
          <div className="w-24 h-24 rounded-full bg-blue-200 flex items-center justify-center text-4xl font-bold text-blue-700 shadow">
            🧑‍🏫
          </div>
        </div>
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`px-4 py-2 rounded-2xl max-w-[70%] text-sm shadow-sm ${
                msg.sender === "user"
                  ? "bg-blue-500 text-white rounded-br-none"
                  : "bg-gray-100 text-gray-800 rounded-bl-none"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-blue-700 transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}
