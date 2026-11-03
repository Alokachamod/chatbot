/**
 * ============================================================================
 * Novis Bot - Complete AI Chatbot Script
 * ============================================================================
 * Features:
 * - Direct integration with Google Gemini 1.5 Flash API
 * - Multi-turn conversational memory (chat context)
 * - Safe LocalStorage API Key storage (prevents leaking secrets to Git)
 * - Dynamic markdown formatting (code blocks, bold, lists)
 * - Animated typing indicator and smooth auto-scrolling
 * - Quick prompt suggestion chips & clear chat support
 * ============================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const chatForm = document.getElementById("chatForm");
    const userInput = document.getElementById("userInput");
    const sendBtn = document.getElementById("sendBtn");
    const chatBox = document.getElementById("chatBox");
    const messagesList = document.getElementById("messagesList");
    const typingIndicator = document.getElementById("typingIndicator");
    const welcomeCard = document.getElementById("welcomeCard");
    const clearChatBtn = document.getElementById("clearChatBtn");
    const promptChips = document.querySelectorAll(".prompt-chip");

    // API Key Modal Elements
    const apiKeyModalEl = document.getElementById("apiKeyModal");
    const apiKeyModal = apiKeyModalEl ? new bootstrap.Modal(apiKeyModalEl) : null;
    const apiKeyInput = document.getElementById("apiKeyInput");
    const saveKeyBtn = document.getElementById("saveKeyBtn");
    const removeKeyBtn = document.getElementById("removeKeyBtn");
    const toggleKeyVisibility = document.getElementById("toggleKeyVisibility");
    const toggleKeyIcon = document.getElementById("toggleKeyIcon");
    const keyStatusBadge = document.getElementById("keyStatusBadge");
    const botStatusText = document.getElementById("botStatusText");

    const STORAGE_KEY = "novis_bot_gemini_api_key";
    const GEMINI_MODEL = "gemini-1.5-flash";

    // Conversation history for multi-turn context
    let conversationHistory = [];

    /**
     * Get stored API key or return empty string
     */
    function getApiKey() {
        return localStorage.getItem(STORAGE_KEY) || "";
    }

    /**
     * Update UI indicators based on API key availability
     */
    function updateKeyStatusUI() {
        const key = getApiKey();
        if (key && key.trim() !== "") {
            keyStatusBadge.classList.add("configured");
            keyStatusBadge.setAttribute("title", "API Key configured");
            botStatusText.innerHTML = "AI Assistant &bull; Online";
            if (apiKeyInput) apiKeyInput.value = key;
        } else {
            keyStatusBadge.classList.remove("configured");
            keyStatusBadge.setAttribute("title", "API Key missing - click to configure");
            botStatusText.innerHTML = "AI Assistant &bull; Key Required";
            if (apiKeyInput) apiKeyInput.value = "";
        }
    }

    /**
     * Format current time as HH:MM AM/PM
     */
    function getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    /**
     * Smoothly scroll chat box to latest message
     */
    function scrollToBottom() {
        chatBox.scrollTo({
            top: chatBox.scrollHeight,
            behavior: "smooth"
        });
    }

    /**
     * Escape raw HTML
     */
    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Lightweight markdown parser for Gemini responses
     */
    function parseMarkdown(text) {
        if (!text) return "";

        // Escape HTML first
        let html = escapeHtml(text);

        // Code blocks: ```language ... ```
        html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
        });

        // Inline code: `code`
        html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

        // Bold: **text**
        html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

        // Italic: *text*
        html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

        // Bullet lists: lines starting with * or -
        html = html.replace(/(?:^|\n)[*-] (.*?)(?=(?:\n[*-] )|\n\n|$)/g, "\n<li>$1</li>");
        html = html.replace(/((?:<li>.*?<\/li>\s*)+)/g, "<ul>$1</ul>");

        // Line breaks (convert newlines not within tags to <br>)
        html = html.replace(/\n(?!(?:<\/ul>|<\/pre>|<li>))/g, "<br>");

        return html;
    }

    /**
     * Append a message bubble to the chat
     */
    function appendMessage(sender, text, isError = false) {
        const time = getCurrentTime();
        const row = document.createElement("div");
        row.className = `message-row ${sender === "user" ? "user-row" : "bot-row"}`;

        if (sender === "user") {
            row.innerHTML = `
                <div class="msg-avatar user-avatar-small">
                    <i class="bi bi-person-fill"></i>
                </div>
                <div class="message-content">
                    <div class="message-bubble user-bubble">
                        <p class="mb-0">${escapeHtml(text)}</p>
                    </div>
                    <div class="message-meta">
                        <span class="message-time">${time}</span>
                    </div>
                </div>
            `;
        } else {
            const formattedContent = isError 
                ? `<span class="text-danger"><i class="bi bi-exclamation-triangle me-1"></i>${escapeHtml(text)}</span>` 
                : parseMarkdown(text);

            row.innerHTML = `
                <div class="msg-avatar bot-avatar-small ${isError ? 'border-danger text-danger' : ''}">
                    <i class="bi bi-robot"></i>
                </div>
                <div class="message-content">
                    <div class="message-bubble bot-bubble ${isError ? 'border-danger' : ''}">
                        ${formattedContent}
                    </div>
                    <div class="message-meta">
                        <span class="message-time">${time}</span>
                        ${!isError ? `
                        <button type="button" class="copy-btn" title="Copy text">
                            <i class="bi bi-copy"></i>
                        </button>` : ''}
                    </div>
                </div>
            `;

            // Attach copy event listener
            const copyBtn = row.querySelector(".copy-btn");
            if (copyBtn) {
                copyBtn.addEventListener("click", () => {
                    navigator.clipboard.writeText(text).then(() => {
                        copyBtn.innerHTML = `<i class="bi bi-check2 text-success"></i>`;
                        setTimeout(() => {
                            copyBtn.innerHTML = `<i class="bi bi-copy"></i>`;
                        }, 2000);
                    }).catch(err => console.error("Copy failed:", err));
                });
            }
        }

        messagesList.appendChild(row);
        scrollToBottom();
    }

    /**
     * Show/Hide animated typing indicator
     */
    function showTyping() {
        typingIndicator.classList.remove("d-none");
        scrollToBottom();
    }

    function hideTyping() {
        typingIndicator.classList.add("d-none");
    }

    /**
     * Toggle sending state (disable input & button while thinking)
     */
    function setThinking(isThinking) {
        if (isThinking) {
            showTyping();
            sendBtn.disabled = true;
            userInput.disabled = true;
        } else {
            hideTyping();
            sendBtn.disabled = false;
            userInput.disabled = false;
            userInput.focus();
        }
    }

    /**
     * Send message to Google Gemini API
     */
    async function sendMessage(userText) {
        const apiKey = getApiKey();

        // If no API key configured, prompt the user via modal
        if (!apiKey || apiKey.trim() === "") {
            appendMessage("bot", "Please configure your Google Gemini API key to start chatting. Click the 'API Key' button in the top right or use the settings dialog.", true);
            if (apiKeyModal) {
                apiKeyModal.show();
            }
            return;
        }

        // Hide welcome banner after first message
        if (welcomeCard) {
            welcomeCard.style.display = "none";
        }

        // Append user bubble
        appendMessage("user", userText);

        // Add to conversation history
        conversationHistory.push({
            role: "user",
            parts: [{ text: userText }]
        });

        setThinking(true);

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey.trim()}`;

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: conversationHistory,
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1000
                    }
                })
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMsg = data.error?.message || `HTTP ${response.status}: Failed to generate response.`;
                appendMessage("bot", `Gemini API Error: ${errorMsg}`, true);
                // Rollback last question from history so it can be retried cleanly
                conversationHistory.pop();
                return;
            }

            const botReply = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (botReply) {
                // Save model reply to conversation history
                conversationHistory.push({
                    role: "model",
                    parts: [{ text: botReply }]
                });

                appendMessage("bot", botReply);
            } else {
                appendMessage("bot", "No response received. The output may have been filtered by safety settings.", true);
            }

        } catch (error) {
            console.error("Gemini API Request Error:", error);
            appendMessage("bot", `Network Error: ${error.message || "Failed to connect to the Gemini API. Please check your internet connection or API key."}`, true);
            conversationHistory.pop();
        } finally {
            setThinking(false);
        }
    }

    /**
     * Form Submit Listener
     */
    chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = userInput.value.trim();
        if (!text) return;

        userInput.value = "";
        sendMessage(text);
    });

    /**
     * Quick Prompt Chips Click
     */
    promptChips.forEach(chip => {
        chip.addEventListener("click", () => {
            const promptText = chip.getAttribute("data-prompt") || chip.innerText.trim();
            sendMessage(promptText);
        });
    });

    /**
     * Clear Chat Listener
     */
    clearChatBtn.addEventListener("click", () => {
        messagesList.innerHTML = "";
        conversationHistory = [];
        if (welcomeCard) {
            welcomeCard.style.display = "block";
        }
        userInput.value = "";
        userInput.focus();
    });

    /**
     * API Key Modal Management
     */
    saveKeyBtn.addEventListener("click", () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem(STORAGE_KEY, key);
            updateKeyStatusUI();
            if (apiKeyModal) apiKeyModal.hide();
            appendMessage("bot", "API Key saved successfully! How can I assist you today? 😊");
        } else {
            alert("Please enter a valid API key.");
        }
    });

    removeKeyBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to remove your saved API key?")) {
            localStorage.removeItem(STORAGE_KEY);
            updateKeyStatusUI();
            if (apiKeyModal) apiKeyModal.hide();
            appendMessage("bot", "API Key removed. You will need to provide an API key to chat with Novis Bot.", true);
        }
    });

    toggleKeyVisibility.addEventListener("click", () => {
        const isPassword = apiKeyInput.type === "password";
        apiKeyInput.type = isPassword ? "text" : "password";
        toggleKeyIcon.className = isPassword ? "bi bi-eye-slash" : "bi bi-eye";
    });

    // Initialize UI on load
    updateKeyStatusUI();
    userInput.focus();
});
