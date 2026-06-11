# AegisMed AI - Responsible Medical Assistant Bot

AegisMed AI is an advanced medical assistant bot designed for preliminary health guidance, symptom checking, and report analysis. The application runs entirely on the client side, ensuring that user conversations and medical documents remain private.

## Key Features

- Symptom Assessment: Provides preliminary educational guidance and categories based on symptom descriptions.
- Emergency Redflags and Risk Highlighting: Automatically flags clinical indicators of potential medical emergencies. Displays clear, context-sensitive risk badges (such as Heart Attack, Stroke, or Anaphylaxis) inside the chat bubble and the sidebar widget.
- Dynamic Triage: Syncs emergency warnings with the latest user query, showing active emergency indicators and hiding them when symptoms resolve to mild conditions.
- Document and Report Summarizer: Parses uploaded medical documents, skin check images, or lab reports to generate brief summaries, decode medical jargon, and extract vitals.
- Privacy Guard: Operates with direct browser-to-API communication. Stored logs and API keys remain in localStorage and can be wiped instantly with the Clear Chat or Revoke Consent controls.
- Clean Details Mode: Switches the screen to a focused document layout when viewing the Privacy & Consent terms, hiding input chatboxes and cleaning header components.

## Technology Stack

- Build Tool: Vite
- Frontend: HTML5, Vanilla CSS3, Vanilla JavaScript (ES Module structure)
- Generative AI Integration: Google Generative AI SDK (Gemini API)

## Installation and Setup

1. Install Dependencies:
   Run the following command in the project root to install Vite and the Google Generative AI SDK:
   ```bash
   npm install
   ```

2. Environment Configurations:
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   Open the new `.env` file and set your API key:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. Run Development Server:
   Start the Vite local development server:
   ```bash
   npm run dev
   ```
   Open the local server URL (usually http://localhost:3000/ or http://localhost:3001/) in your browser.

4. Build for Production:
   To build static production files inside the dist directory, run:
   ```bash
   npm run build
   ```

## Medical Disclaimer

AegisMed AI is for educational and preliminary support purposes only. It is not a doctor, cannot diagnose medical conditions, and should not be used as a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified health professional in case of medical concerns or emergencies.
