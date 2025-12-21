// api/utils/modelClient.js
import axios from "axios";
import { errorHandler } from "./error.js";

export const generateReinforcementItems = async ({
  conceptTitle,
  conceptDescription,
  difficulty = "medium",
  numQuestions = 3,
  numFlashcards = 2,
}) => {
  const baseUrl = process.env.QG_MODEL_URL;

  if (!baseUrl) {
    throw errorHandler(
      500,
      "QG_MODEL_URL not configured. Please set it in .env"
    );
  }

  try {
    const response = await axios.post(baseUrl, {
      concept_title: conceptTitle,
      concept_description: conceptDescription,
      difficulty,
      num_questions: numQuestions,
      num_flashcards: numFlashcards,
    });

    const data = response.data || {};
    if (!Array.isArray(data.questions)) data.questions = [];
    if (!Array.isArray(data.flashcards)) data.flashcards = [];

    return data;
  } catch (err) {
    console.error("====== ACE MODEL CALL ERROR ======");
    console.error("URL:", baseUrl);
    console.error("Status:", err.response?.status);
    console.error("Response data:", err.response?.data);
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);
    console.error("==================================");

    throw errorHandler(500, "Failed to generate items from ACE model");
  }
};
