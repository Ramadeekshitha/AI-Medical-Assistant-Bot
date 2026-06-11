import { GoogleGenerativeAI } from '@google/generative-ai';

// System instruction to guide the Gemini model on medical safety, disclaimers, and jargon simplification
const SYSTEM_INSTRUCTION = `
You are AegisMed AI, an advanced medical assistant bot designed for preliminary health guidance, symptom checking, and report analysis.
Your primary directive is patient safety and education.

CRITICAL INSTRUCTIONS:
1. EMERGENCY RED FLAGS:
   If the user's symptoms indicate a potential medical emergency (including but not limited to: chest pain or pressure, shortness of breath or difficulty breathing, sudden severe headache, sudden weakness or numbness on one side of the body, difficulty speaking, loss of vision, severe bleeding, anaphylactic reaction signs like throat swelling, severe abdominal pain), you MUST prioritize safety.
   - Start your response exactly with: "[EMERGENCY][RISKS: Risk 1, Risk 2, ...]" where you list 2-4 possible critical medical conditions/risks (e.g., Heart Attack, Stroke, Anaphylaxis, Sepsis, Internal Bleeding, Appendicitis) that match their symptoms. The list of risks must be enclosed in [RISKS: ...] as comma-separated values.
   - Urgently direct the patient to call emergency services (e.g., 911, 112, 999, 100) or visit the nearest emergency department immediately.
   - Mention the possible risks in a simple, calm, and reassuring way. Do not explain them in detail in the initial response to avoid inducing unnecessary panic.
   - If the user specifically asks you to explain these risks or conditions further in a subsequent message, then explain them clearly, thoroughly, and calmly.
   - Give concise first-aid steps if applicable (e.g., rest, do not ingest anything, etc.).
   
2. MEDICAL DISCLAIMER:
   - You are NOT a doctor. You provide educational and preliminary support only.
   - Never say "You have X" or diagnose definitively. Use terms like "These symptoms could suggest...", "There's a possibility of...", "This is commonly associated with...", or "It would be wise to evaluate for...".
   - Advise the user to consult a qualified health professional for definitive diagnoses.

3. PATIENT-FRIENDLY & BRIEF TRANSLATION:
   - Keep your initial response content extremely simple, brief, and straightforward. Do not overwhelm the user with detailed explanations initially.
   - Avoid unexplained medical jargon. If you must use medical terms (e.g., "myocardial infarction", "urticaria", "dyspnea"), immediately translate them into simple terms (e.g., "heart attack", "hives", "shortness of breath").
   - If the user prompts you again to explain the response, terms, or conditions further, then provide a clear, detailed, and comprehensive explanation.

4. UNCERTAINTY HANDLING:
   - If the symptoms are too vague or multiple interpretations are possible, explicitly state: "These symptoms are very general and could represent many different conditions. To help understand better, a doctor might ask: [List 3-4 simple questions, e.g., how long has this been occurring, does anything make it better or worse, etc.]."
   - If analyzing a report or image, if the quality is low or key information is missing, state your uncertainty clearly: "The provided image/document does not show sufficient detail to draw preliminary suggestions. Please consult a doctor and provide a clearer copy if possible."

5. STRUCTURAL FORMAT:
   - For regular symptom chats:
     * Brief summary of what was understood.
     * Potential general categories or causes (tentative).
     * Important things to monitor.
     * Suggested questions for their doctor.
   - For medical report/image analysis:
     * Patient-friendly summary of the findings.
     * Explanation of key terms and indicators (e.g., high blood pressure, elevated white blood cells).
     * Recommended next steps (non-diagnostic) and questions to ask their doctor.
`;

/**
 * Gets the Gemini API Key from localStorage or environment variables.
 * @returns {string|null}
 */
export function getApiKey() {
  // First check localStorage for a user-configured key
  const savedKey = localStorage.getItem('AEGIS_GEMINI_API_KEY');
  if (savedKey && savedKey.trim() !== '') {
    return savedKey.trim();
  }
  
  // Fallback to Vite environment variable
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (envKey && envKey.trim() !== '' && envKey !== 'your_gemini_api_key_here') {
    return envKey.trim();
  }
  
  return null;
}

/**
 * Saves the API key to localStorage.
 * @param {string} key 
 */
export function saveApiKey(key) {
  if (key && key.trim() !== '') {
    localStorage.setItem('AEGIS_GEMINI_API_KEY', key.trim());
  } else {
    localStorage.removeItem('AEGIS_GEMINI_API_KEY');
  }
}

/**
 * Converts a File object to the generative model inlineData format.
 * @param {File} file 
 * @returns {Promise<{inlineData: {data: string, mimeType: string}}>}
 */
function fileToGenerativePart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Sends a message and optional files to the Gemini API.
 * @param {Array} history - Previous messages in {role, parts} format
 * @param {string} userMessage - The current message text
 * @param {Array<File>} files - Attached images or documents
 * @returns {Promise<{text: string, isEmergency: boolean}>}
 */
export async function queryGemini(history, userMessage, files = []) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Fallback list of models to try in case of 503/high demand
  const modelsToTry = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest'
  ];

  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`Attempting query with model: ${modelName}`);
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_INSTRUCTION
      });

      // Prepare input contents
      const contents = [];
      
      // 1. Map past history into Gemini API format
      if (history && history.length > 0) {
        history.forEach(msg => {
          if (msg.role === 'user' || msg.role === 'model') {
            contents.push({
              role: msg.role,
              parts: [{ text: msg.text }]
            });
          }
        });
      }

      // 2. Prepare the current user message and attachments
      const currentParts = [];
      
      if (files && files.length > 0) {
        for (const file of files) {
          try {
            const part = await fileToGenerativePart(file);
            currentParts.push(part);
          } catch (err) {
            console.error('Error processing file:', file.name, err);
            throw new Error(`Failed to process file "${file.name}".`);
          }
        }
      }

      // Add the text message
      currentParts.push({ text: userMessage || 'Analyze the uploaded report/image.' });

      // Add current user turn to the conversation structure
      contents.push({
        role: 'user',
        parts: currentParts
      });

      const result = await model.generateContent({
        contents,
        generationConfig: {
          temperature: 0.2, // Low temperature for more factual and safer responses
          topP: 0.8,
          topK: 40,
        }
      });

      const response = await result.response;
      const responseText = response.text();
      
      // Check if the model triggered an emergency flag
      const isEmergency = responseText.trim().startsWith('[EMERGENCY]');
      
      // Clean the text by removing the [EMERGENCY] prefix and extracting the risks
      let cleanedText = responseText;
      let risks = [];
      
      if (isEmergency) {
        // Extract risks inside [RISKS: ...]
        const risksMatch = responseText.match(/\[RISKS:\s*([^\]]+)\]/i);
        if (risksMatch) {
          risks = risksMatch[1].split(',').map(r => r.trim());
        }
        
        // Clean the tokens out of the response text
        cleanedText = responseText
          .replace('[EMERGENCY]', '')
          .replace(/\[RISKS:\s*([^\]]+)\]/i, '')
          .trim();
      }

      return {
        text: cleanedText,
        isEmergency,
        risks
      };
    } catch (error) {
      console.warn(`Model ${modelName} query failed:`, error);
      lastError = error;

      // Handle specific invalid key scenarios early
      if (error.message && error.message.includes('API key not valid')) {
        throw new Error('API_KEY_INVALID');
      }
      // If it is any other error (like 503 or 404), loop continues to try next model
    }
  }

  // If all models failed, throw the last error
  console.error('All fallback models failed:', lastError);
  throw lastError;
}
