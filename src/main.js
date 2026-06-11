import { ICONS } from './icons.js';
import { queryGemini, getApiKey, saveApiKey } from './gemini.js';

// Application State
const state = {
  chatHistory: [],
  attachedFiles: [],
  consentGiven: localStorage.getItem('AEGIS_CONSENT_GIVEN') === 'true',
  isQuerying: false
};

// DOM Elements
const elements = {
  consentModal: document.getElementById('consent-modal'),
  agreeCheckbox: document.getElementById('agree-checkbox'),
  consentSubmitBtn: document.getElementById('consent-submit-btn'),
  
  apiKeyInput: document.getElementById('api-key-input'),
  saveApiKeyBtn: document.getElementById('save-api-key-btn'),
  apiStatusDot: document.getElementById('api-status-dot'),
  
  chatMessagesContainer: document.getElementById('chat-messages-container'),
  chatTextarea: document.getElementById('chat-textarea'),
  fileUploadInput: document.getElementById('file-upload-input'),
  sendChatBtn: document.getElementById('send-chat-btn'),
  clearChatBtn: document.getElementById('clear-chat-btn'),
  uploadPreviews: document.getElementById('upload-previews'),
  chatTypingIndicator: document.getElementById('chat-typing-indicator'),
  chatInputArea: document.getElementById('chat-input-area'),
  
  emergencyAlert: document.getElementById('emergency-alert'),
  emergencyAlertRisks: document.getElementById('emergency-alert-risks'),
  emergencyAlertRisksList: document.getElementById('emergency-alert-risks-list'),
  dropZone: document.getElementById('drop-zone'),
  
  analysisSummarySection: document.getElementById('analysis-summary-section'),
  reportSummaryText: document.getElementById('report-summary-text'),
  reportTermsCard: document.getElementById('report-terms-card'),
  reportTermsText: document.getElementById('report-terms-text'),
  reportVitalsCard: document.getElementById('report-vitals-card'),
  vitalsIndicatorsList: document.getElementById('vitals-indicators-list'),
  
  menuChat: document.getElementById('menu-chat'),
  menuPrivacy: document.getElementById('menu-privacy')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  setupIcons();
  setupConsentModal();
  setupApiSettings();
  setupChatHandlers();
  setupUploadAndDragDrop();
  setupNavigation();
  
  // Load existing API Key if set
  const key = getApiKey();
  if (key) {
    elements.apiKeyInput.value = key;
    updateApiStatus(true);
  } else {
    updateApiStatus(false);
  }

  // Load chat logs if consent is already given
  if (state.consentGiven) {
    loadChatSession();
  }
});

// Replace icon placeholders with inline SVGs
function setupIcons() {
  const replacePlaceholder = (selector, svgString) => {
    document.querySelectorAll(selector).forEach(el => {
      el.outerHTML = svgString;
    });
  };
  
  replacePlaceholder('.heart-icon-placeholder', ICONS.heart);
  replacePlaceholder('.brand-heart-icon', ICONS.heart);
  replacePlaceholder('.warning-icon-placeholder', ICONS.warning);
  replacePlaceholder('.activity-icon-placeholder', ICONS.activity);
  replacePlaceholder('.shield-icon-placeholder', ICONS.shield);
  replacePlaceholder('.trash-icon-placeholder', ICONS.trash);
  replacePlaceholder('.paperclip-icon-placeholder', ICONS.paperclip);
  replacePlaceholder('.send-icon-placeholder', ICONS.send);
  replacePlaceholder('.alert-circle-icon-placeholder', ICONS.alertCircle);
  replacePlaceholder('.upload-cloud-icon-placeholder', ICONS.uploadCloud);
  replacePlaceholder('.file-text-icon-placeholder', ICONS.fileText);
}

// Consent Modal Control
function setupConsentModal() {
  if (state.consentGiven) {
    elements.consentModal.style.display = 'none';
  } else {
    elements.consentModal.style.display = 'flex';
  }

  elements.agreeCheckbox.addEventListener('change', (e) => {
    elements.consentSubmitBtn.disabled = !e.target.checked;
  });

  elements.consentSubmitBtn.addEventListener('click', () => {
    if (elements.agreeCheckbox.checked) {
      localStorage.setItem('AEGIS_CONSENT_GIVEN', 'true');
      state.consentGiven = true;
      elements.consentModal.style.display = 'none';
      initializeChatGreeting();
    }
  });
}

// API Key UI Controllers
function setupApiSettings() {
  elements.saveApiKeyBtn.addEventListener('click', () => {
    const key = elements.apiKeyInput.value.trim();
    if (key === '') {
      saveApiKey('');
      updateApiStatus(false);
      addSystemMessage('API Key removed. Please configure a valid key to talk to AegisMed AI.');
    } else {
      saveApiKey(key);
      updateApiStatus(true);
      addSystemMessage('API Key connected successfully! How can I assist you with your health query today?');
    }
  });
}

function updateApiStatus(connected) {
  if (connected) {
    elements.apiStatusDot.className = 'api-status connected';
    elements.apiStatusDot.title = 'Connected';
  } else {
    elements.apiStatusDot.className = 'api-status';
    elements.apiStatusDot.title = 'Disconnected - Click Save to connect';
  }
}

// Chat Functionality
function initializeChatGreeting() {
  // Clear any existing logs
  elements.chatMessagesContainer.innerHTML = '';
  
  // Add warning message
  addSystemMessage('<strong>Notice:</strong> This bot provides educational information and triage advice based on patterns. It does not diagnose. In case of an emergency, immediately call emergency responders.');
  
  // Greeting bubble
  addMessage('bot', `Hello! I am AegisMed AI, your educational medical assistant. 

How can I help you today? You can:
1. Describe symptoms you are experiencing.
2. Upload medical reports or images (like rash photos, prescriptions, or lab reports) for summary and terminology breakdown.

*Please note: I am an AI, not a doctor. My analysis is preliminary.*`);
}

function loadChatSession() {
  const savedHistory = localStorage.getItem('AEGIS_CHAT_HISTORY');
  if (savedHistory) {
    try {
      state.chatHistory = JSON.parse(savedHistory);
      elements.chatMessagesContainer.innerHTML = '';
      
      // Add system note
      addSystemMessage('<strong>Notice:</strong> This session log is restored from your local browser. It is not saved on any database.');
      
      state.chatHistory.forEach(msg => {
        // Simple sanitization helper during render
        addMessage(msg.role, msg.text, false, msg.isEmergency, msg.risks);
      });
      
      // Display emergency widgets only if the latest response in history is severe
      const modelMsgs = state.chatHistory.filter(msg => msg.role === 'model');
      const latestMsg = modelMsgs[modelMsgs.length - 1];
      if (latestMsg && latestMsg.isEmergency) {
        elements.emergencyAlert.style.display = 'flex';
        updateEmergencyAlertWidget(latestMsg.risks || []);
        
        // Restore the system notice warning message in the chat logs
        addSystemMessage('<strong>EMERGENCY ACTION REQUIRED:</strong> Your symptoms match emergency indicators. Please stop using this bot and call your emergency medical number immediately.');
      } else {
        elements.emergencyAlert.style.display = 'none';
        if (elements.emergencyAlertRisks) {
          elements.emergencyAlertRisks.style.display = 'none';
        }
      }
    } catch (e) {
      console.error('Failed to load local chat history', e);
      initializeChatGreeting();
    }
  } else {
    initializeChatGreeting();
  }
}

function saveChatSession() {
  localStorage.setItem('AEGIS_CHAT_HISTORY', JSON.stringify(state.chatHistory));
}

function addMessage(role, text, appendToState = true, isEmergency = false, risks = []) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${role}`;
  if (isEmergency) {
    messageEl.classList.add('emergency-msg');
  }
  
  const avatarEl = document.createElement('div');
  avatarEl.className = 'message-avatar';
  if (isEmergency) {
    avatarEl.innerHTML = ICONS.warning;
  } else {
    avatarEl.innerHTML = role === 'user' ? ICONS.heart : ICONS.activity;
  }
  
  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'message-bubble';
  
  // Convert basic markdown-like syntax (* and \n) to HTML
  let formattedText = formatMarkdown(text);
  
  if (isEmergency && risks && risks.length > 0) {
    const risksHtml = `
      <div class="message-risks-highlight">
        <div class="risks-highlight-header">
          ${ICONS.warning}
          <span>POTENTIAL CRITICAL RISKS DETECTED:</span>
        </div>
        <div class="risks-highlight-badges">
          ${risks.map(risk => `<span class="risk-badge">${risk}</span>`).join('')}
        </div>
        <div class="risks-highlight-note">
          These conditions represent potential medical emergencies. Please consult a professional or call emergency services immediately.
        </div>
      </div>
    `;
    formattedText = risksHtml + formattedText;
  }
  
  bubbleEl.innerHTML = formattedText;
  
  const timeEl = document.createElement('div');
  timeEl.className = 'message-time';
  timeEl.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  messageEl.appendChild(avatarEl);
  messageEl.appendChild(bubbleEl);
  messageEl.appendChild(timeEl);
  
  elements.chatMessagesContainer.appendChild(messageEl);
  elements.chatMessagesContainer.scrollTop = elements.chatMessagesContainer.scrollHeight;
  
  if (appendToState) {
    state.chatHistory.push({ role, text, isEmergency, risks });
    saveChatSession();
  }
}

// Dynamically update left sidebar emergency widget risks
function updateEmergencyAlertWidget(risks) {
  if (elements.emergencyAlertRisks && elements.emergencyAlertRisksList) {
    if (risks && risks.length > 0) {
      elements.emergencyAlertRisks.style.display = 'block';
      elements.emergencyAlertRisksList.innerHTML = risks.map(risk => `
        <span class="risk-badge" style="font-size: 0.7rem; padding: 2px 8px; margin-bottom: 2px;">${risk}</span>
      `).join('');
    } else {
      elements.emergencyAlertRisks.style.display = 'none';
      elements.emergencyAlertRisksList.innerHTML = '';
    }
  }
}

function addSystemMessage(text) {
  const messageEl = document.createElement('div');
  messageEl.className = 'message system';
  
  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'message-bubble';
  bubbleEl.innerHTML = `${ICONS.warning} <div>${text}</div>`;
  
  messageEl.appendChild(bubbleEl);
  elements.chatMessagesContainer.appendChild(messageEl);
  elements.chatMessagesContainer.scrollTop = elements.chatMessagesContainer.scrollHeight;
}

// Convert markdown stars and headers to HTML with professional, tight spacing
function formatMarkdown(text) {
  if (!text) return '';
  
  // Standard character escaping to prevent injection
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Bold (**bold**) and Italic (*italic*)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Headers (### Header)
  html = html.replace(/^### (.*?)$/gm, '<h4 style="margin: 6px 0 2px 0; font-family: var(--font-heading); color: var(--accent-teal);">$1</h4>');

  // Parse paragraph blocks and list structures line-by-line
  const lines = html.split('\n');
  let result = [];
  let inList = false;

  for (let line of lines) {
    const trimmed = line.trim();
    
    // Check if line represents a bullet list item
    const isListItem = trimmed.startsWith('- ') || trimmed.startsWith('* ');
    
    if (isListItem) {
      if (!inList) {
        result.push('<ul style="margin: 4px 0 4px 20px; padding: 0; list-style-type: disc;">');
        inList = true;
      }
      const itemContent = trimmed.substring(2).trim();
      result.push(`<li style="margin-bottom: 2px; line-height: 1.4;">${itemContent}</li>`);
    } else {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      
      if (trimmed === '') {
        // Use a small spacer block instead of a double newline break
        result.push('<div style="height: 6px;"></div>');
      } else {
        // Render regular paragraph block with tight spacing
        result.push(`<p style="margin: 0 0 4px 0; line-height: 1.4;">${trimmed}</p>`);
      }
    }
  }

  if (inList) {
    result.push('</ul>');
  }

  return result.join('');
}

// Setup input interactions
function setupChatHandlers() {
  // Auto-resize textarea
  elements.chatTextarea.addEventListener('input', () => {
    elements.chatTextarea.style.height = 'auto';
    elements.chatTextarea.style.height = `${elements.chatTextarea.scrollHeight}px`;
  });

  // Enter triggers send, shift+enter new line
  elements.chatTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  elements.sendChatBtn.addEventListener('click', handleSendMessage);
  
  elements.clearChatBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear your conversation history? All uploaded reports and chat histories will be removed.')) {
      state.chatHistory = [];
      localStorage.removeItem('AEGIS_CHAT_HISTORY');
      elements.emergencyAlert.style.display = 'none';
      if (elements.emergencyAlertRisks) {
        elements.emergencyAlertRisks.style.display = 'none';
      }
      elements.analysisSummarySection.style.display = 'none';
      initializeChatGreeting();
    }
  });
}

// Upload & Drag-and-Drop Handler
function setupUploadAndDragDrop() {
  const fileInput = elements.fileUploadInput;
  
  fileInput.addEventListener('change', (e) => {
    handleFilesSelected(e.target.files);
  });

  // Drag and drop events for right side dashboard
  const dropZone = elements.dropZone;
  
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--accent-teal)';
      dropZone.style.background = 'rgba(13, 219, 184, 0.05)';
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--card-border)';
      dropZone.style.background = 'rgba(0, 0, 0, 0.15)';
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleReportDrop(files);
    }
  });

  dropZone.addEventListener('click', () => {
    fileInput.click();
  });
}

// Handle file selections from chat attachment bar
function handleFilesSelected(filesList) {
  for (let i = 0; i < filesList.length; i++) {
    const file = filesList[i];
    if (state.attachedFiles.some(f => f.name === file.name && f.size === file.size)) {
      continue; // Skip duplicate
    }
    state.attachedFiles.push(file);
    renderUploadPreviews();
  }
}

// Render uploaded attachments in the preview row
function renderUploadPreviews() {
  elements.uploadPreviews.innerHTML = '';
  state.attachedFiles.forEach((file, index) => {
    const tag = document.createElement('div');
    tag.className = 'preview-tag';
    
    const nameSpan = document.createElement('span');
    nameSpan.innerText = file.name.length > 15 ? `${file.name.substring(0, 12)}...` : file.name;
    
    const removeBtn = document.createElement('span');
    removeBtn.className = 'preview-tag-remove';
    removeBtn.innerHTML = ICONS.x;
    removeBtn.addEventListener('click', () => {
      state.attachedFiles.splice(index, 1);
      renderUploadPreviews();
    });

    // If it's an image, render a tiny thumbnail
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
      tag.appendChild(img);
    } else {
      const docIcon = document.createElement('span');
      docIcon.innerHTML = ICONS.fileText;
      docIcon.style.color = 'var(--accent-teal)';
      docIcon.style.display = 'inline-flex';
      tag.appendChild(docIcon);
    }
    
    tag.appendChild(nameSpan);
    tag.appendChild(removeBtn);
    elements.uploadPreviews.appendChild(tag);
  });
}

// Send Chat Message Flow
async function handleSendMessage() {
  if (state.isQuerying) return;
  
  const text = elements.chatTextarea.value.trim();
  const files = [...state.attachedFiles];
  
  if (text === '' && files.length === 0) return;
  
  // Check API key availability
  if (!getApiKey()) {
    addSystemMessage('<strong>API Key Required:</strong> Please verify that your Google Gemini API Key is configured in the local <code>.env</code> file.');
    return;
  }

  // Clear inputs
  elements.chatTextarea.value = '';
  elements.chatTextarea.style.height = '38px';
  state.attachedFiles = [];
  renderUploadPreviews();

  // If there are files, format the user message bubble nicely
  let messageDisplay = text;
  if (files.length > 0) {
    const fileListStr = files.map(f => `[Attachment: ${f.name}]`).join(' ');
    messageDisplay = text ? `${text}\n\n*${fileListStr}*` : `*Analyzed attachments: ${fileListStr}*`;
  }

  // Add user message to UI
  addMessage('user', messageDisplay);

  // If files were attached, we also trigger an auto-analysis in the right panel dashboard
  if (files.length > 0) {
    runDocumentAnalysis(files, text);
  }

  // Query Gemini API
  try {
    state.isQuerying = true;
    elements.chatTypingIndicator.style.display = 'flex';
    
    const response = await queryGemini(state.chatHistory, text, files);
    
    elements.chatTypingIndicator.style.display = 'none';
    state.isQuerying = false;
    
    // Add bot message
    addMessage('model', response.text, true, response.isEmergency, response.risks);
    
    // Trigger emergency alert widget if model flagged it, otherwise hide it
    if (response.isEmergency) {
      elements.emergencyAlert.style.display = 'flex';
      updateEmergencyAlertWidget(response.risks);
      
      // Inject urgent warning alert in chat logs
      addSystemMessage('<strong>EMERGENCY ACTION REQUIRED:</strong> Your symptoms match emergency indicators. Please stop using this bot and call your emergency medical number immediately.');
    } else {
      elements.emergencyAlert.style.display = 'none';
      if (elements.emergencyAlertRisks) {
        elements.emergencyAlertRisks.style.display = 'none';
      }
    }
  } catch (err) {
    elements.chatTypingIndicator.style.display = 'none';
    state.isQuerying = false;
    
    console.error('Error during query:', err);
    if (err.message === 'API_KEY_MISSING') {
      addSystemMessage('<strong>API Key Missing:</strong> Please configure your Gemini API Key in the local <code>.env</code> file.');
    } else if (err.message === 'API_KEY_INVALID') {
      addSystemMessage('<strong>Invalid API Key:</strong> The connected key is invalid. Please verify and save your key again.');
    } else {
      addSystemMessage(`<strong>System Error:</strong> ${err.message || 'Something went wrong while connecting to the AI model. Please try again.'}`);
    }
  }
}

// Auto Analysis Flow when document is dropped or uploaded
async function handleReportDrop(files) {
  const fileArray = Array.from(files);
  
  // Check API key
  if (!getApiKey()) {
    addSystemMessage('<strong>API Key Required:</strong> Please configure your Gemini API Key in the local <code>.env</code> file before uploading documents for analysis.');
    return;
  }
  
  // Show a message in chat that we've uploaded files for analysis
  const fileListStr = fileArray.map(f => `[Uploaded: ${f.name}]`).join(', ');
  addSystemMessage(`<strong>Document Analysis Started:</strong> Analyzing ${fileListStr} for dashboard summary...`);
  
  runDocumentAnalysis(fileArray);
}

// Call Gemini for structured dashboard analytics
async function runDocumentAnalysis(files, userInstruction = '') {
  elements.analysisSummarySection.style.display = 'flex';
  elements.reportSummaryText.innerHTML = '<div style="display:flex;align-items:center;gap:8px;"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div><span>Analyzing files...</span></div>';
  elements.reportTermsCard.style.display = 'none';
  elements.reportVitalsCard.style.display = 'none';
  
  const analysisPrompt = `
  Please analyze this uploaded medical report, lab result, prescription, or clinical image.
  Identify key vitals, medical terms, and findings, and format your response strictly using these markers:
  
  SUMMARY: [Provide a comprehensive, highly readable summary of the document for a patient. Avoid technical jargon or explain terms immediately. Explain what this means in plain language.]
  
  JARGON: [Extract any medical terms used, followed by a colon and a patient-friendly definition. Place each on a new line. If no complex jargon is present, write 'None'. Example:
  leukocytosis: elevated white blood cells which could indicate infection
  erythema: redness of the skin]
  
  VITALS: [Extract physiological metrics like blood pressure, heart rate, white blood cell count, glucose levels. Format each on a separate line as: Metric Name: Value (Normal/Elevated/High). If none are found, write 'None'. Example:
  Blood Pressure: 140/90 (High)
  Hemoglobin: 14.2 g/dL (Normal)]
  
  Instruction: ${userInstruction || 'Analyze the report content details.'}
  `;

  try {
    const response = await queryGemini([], analysisPrompt, files);
    parseAnalysisResults(response.text);
  } catch (err) {
    console.error('Analysis error:', err);
    elements.reportSummaryText.innerText = 'Failed to analyze the document. Please verify your API Key and ensure the file is readable.';
  }
}

// Parser for AI analysis response markers
function parseAnalysisResults(text) {
  let summary = '';
  let jargon = [];
  let vitals = [];
  
  // Extract segments using regex/string slicing
  const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=JARGON:|VITALS:|$)/i);
  const jargonMatch = text.match(/JARGON:\s*([\s\S]*?)(?=VITALS:|SUMMARY:|$)/i);
  const vitalsMatch = text.match(/VITALS:\s*([\s\S]*?)(?=SUMMARY:|JARGON:|$)/i);

  if (summaryMatch) {
    summary = summaryMatch[1].trim();
  }
  
  if (jargonMatch) {
    const rawJargon = jargonMatch[1].trim();
    if (rawJargon.toLowerCase() !== 'none' && rawJargon !== '') {
      jargon = rawJargon.split('\n')
        .map(line => line.trim())
        .filter(line => line.includes(':'))
        .map(line => {
          const idx = line.indexOf(':');
          return {
            term: line.slice(0, idx).trim().replace(/^-\s*/, ''),
            definition: line.slice(idx + 1).trim()
          };
        });
    }
  }

  if (vitalsMatch) {
    const rawVitals = vitalsMatch[1].trim();
    if (rawVitals.toLowerCase() !== 'none' && rawVitals !== '') {
      vitals = rawVitals.split('\n')
        .map(line => line.trim())
        .filter(line => line.includes(':'))
        .map(line => {
          const idx = line.indexOf(':');
          const metric = line.slice(0, idx).trim().replace(/^-\s*/, '');
          const valWithStatus = line.slice(idx + 1).trim();
          
          // Determine status
          let status = 'normal';
          if (valWithStatus.toLowerCase().includes('high') || valWithStatus.toLowerCase().includes('danger')) {
            status = 'danger';
          } else if (valWithStatus.toLowerCase().includes('elevated') || valWithStatus.toLowerCase().includes('warning') || valWithStatus.toLowerCase().includes('low')) {
            status = 'warning';
          }
          
          return { metric, value: valWithStatus, status };
        });
    }
  }

  // Populate HTML elements
  elements.reportSummaryText.innerHTML = formatMarkdown(summary || text);
  
  if (jargon.length > 0) {
    elements.reportTermsCard.style.display = 'flex';
    elements.reportTermsText.innerHTML = jargon.map(item => `
      <div style="margin-bottom:8px;">
        <strong style="color:var(--accent-teal); text-transform: capitalize;">${item.term}</strong>: 
        <span style="font-size:0.8rem; color:var(--text-secondary);">${item.definition}</span>
      </div>
    `).join('');
  } else {
    elements.reportTermsCard.style.display = 'none';
  }

  if (vitals.length > 0) {
    elements.reportVitalsCard.style.display = 'flex';
    elements.vitalsIndicatorsList.innerHTML = vitals.map(item => `
      <div class="indicator-row">
        <div class="indicator-label">
          <div class="indicator-dot ${item.status}"></div>
          <span>${item.metric}</span>
        </div>
        <strong style="font-size:0.85rem;">${item.value}</strong>
      </div>
    `).join('');
  } else {
    elements.vitalsIndicatorsList.innerHTML = '';
    elements.reportVitalsCard.style.display = 'none';
  }
}

// Sidebar Menu Navigation Router
function setupNavigation() {
  elements.menuChat.addEventListener('click', () => {
    elements.menuChat.classList.add('active');
    elements.menuPrivacy.classList.remove('active');
    if (elements.chatInputArea) {
      elements.chatInputArea.style.display = 'flex';
    }
    if (elements.clearChatBtn) {
      elements.clearChatBtn.style.display = 'flex';
    }
    loadChatSession();
  });

  elements.menuPrivacy.addEventListener('click', () => {
    elements.menuChat.classList.remove('active');
    elements.menuPrivacy.classList.add('active');
    if (elements.chatInputArea) {
      elements.chatInputArea.style.display = 'none';
    }
    if (elements.clearChatBtn) {
      elements.clearChatBtn.style.display = 'none';
    }
    
    // Render the Privacy Policy screen in the main chat area
    renderPrivacyPolicyView();
  });

  // Event delegation for dynamically rendered revoke consent button
  elements.chatMessagesContainer.addEventListener('click', (e) => {
    const target = e.target.closest('#revoke-consent-btn');
    if (target) {
      if (confirm('This will wipe all local data, clear your API key, and require you to sign the consent terms again. Proceed?')) {
        try {
          localStorage.clear();
        } catch (err) {
          console.warn('Failed to clear localStorage:', err);
        }
        state.chatHistory = [];
        state.attachedFiles = [];
        state.consentGiven = false;
        
        if (elements.emergencyAlert) {
          elements.emergencyAlert.style.display = 'none';
        }
        if (elements.emergencyAlertRisks) {
          elements.emergencyAlertRisks.style.display = 'none';
        }
        if (elements.analysisSummarySection) {
          elements.analysisSummarySection.style.display = 'none';
        }
        
        // Reload page to prompt modal
        window.location.reload();
      }
    }
  });
}

function renderPrivacyPolicyView() {
  elements.chatMessagesContainer.innerHTML = `
    <div class="message bot" style="max-width: 100%; animation: message-in 0.3s ease;">
      <div class="message-avatar">
        ${ICONS.shield}
      </div>
      <div class="message-bubble" style="border-radius: var(--radius-lg); background: var(--bg-secondary);">
        <h3 style="font-family: var(--font-heading); color: var(--accent-teal); margin-bottom: 16px;">Privacy & Security Standards</h3>
        
        <p style="margin-bottom: 12px;">At <strong>AegisMed AI</strong>, user privacy and medical safety are the foundation of our engineering architecture. We enforce the following protocols to protect your sensitive health data:</p>
        
        <h4 style="margin: 14px 0 6px; color: var(--text-primary);">1. No Server-Side Storage</h4>
        <p style="margin-bottom: 12px; font-size: 0.9rem;">This web application is a Single Page Application (SPA). We do <strong>not</strong> maintain external servers, databases, or logs that save your conversation, symptoms, reports, or images. Once you close your browser tab or click "Clear Chat", all data is permanently destroyed.</p>
        
        <h4 style="margin: 14px 0 6px; color: var(--text-primary);">2. Direct API Integration</h4>
        <p style="margin-bottom: 12px; font-size: 0.9rem;">Your data is sent securely from your browser directly to the Google Gemini API using HTTPS encryption. The API key is stored only inside your browser's <code>localStorage</code> (or local <code>.env</code> file) and is never transmitted to any other third-party servers.</p>
        
        <h4 style="margin: 14px 0 6px; color: var(--text-primary);">3. HIPAA Principles Alignment</h4>
        <p style="margin-bottom: 12px; font-size: 0.9rem;">By running all triage logic, state management, and file parsing directly on the client side, we ensure your Protected Health Information (PHI) is isolated to your local environment. We advise users never to upload documents containing clear personally identifiable markers (such as social security numbers, full names, or home addresses).</p>
        
        <h4 style="margin: 14px 0 6px; color: var(--text-primary);">4. Revoking Consent & Data Clearing</h4>
        <p style="margin-bottom: 12px; font-size: 0.9rem;">You can revoke your consent, delete stored settings, and purge all history immediately by clicking the button below:</p>
        
        <button id="revoke-consent-btn" class="modal-btn" style="background: var(--danger); color: white; border: none; padding: 10px 16px; margin-top: 8px;">
          Revoke Consent & Wipe All Data
        </button>
      </div>
    </div>
  `;
}
