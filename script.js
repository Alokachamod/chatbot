document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("chatForm");
    const input = document.getElementById("userInput");
    const sendButton = document.getElementById("sendBtn");
    const chatBox = document.getElementById("chatBox");
    const messageList = document.getElementById("messagesList");
    const loading = document.getElementById("typingIndicator");
    const welcome = document.getElementById("welcomeCard");
    const clearButton = document.getElementById("clearChatBtn");
    const chips = document.querySelectorAll(".prompt-chip");

    const modalElement = document.getElementById("apiKeyModal");
    const keyModal = modalElement ? new bootstrap.Modal(modalElement) : null;
    const keyInput = document.getElementById("apiKeyInput");
    const saveKeyButton = document.getElementById("saveKeyBtn");
    const removeKeyButton = document.getElementById("removeKeyBtn");
    const toggleKeyButton = document.getElementById("toggleKeyVisibility");
    const toggleKeyIcon = document.getElementById("toggleKeyIcon");
    const keyDot = document.getElementById("keyStatusBadge");
    const statusText = document.getElementById("botStatusText");

    const API_KEY = "novis_bot_gemini_api_key";
    const model = "gemini-3.5-flash";
    let history = [];

    function getKey() {
        return localStorage.getItem(API_KEY) || "";
    }

    function updateKeyUI() {
        const key = getKey();
        if (key && key.trim() !== "") {
            keyDot.classList.add("configured");
            keyDot.setAttribute("title", "API Key configured");
            statusText.innerHTML = "AI Assistant &bull; Online";
            if (keyInput) keyInput.value = key;
        } else {
            keyDot.classList.remove("configured");
            keyDot.setAttribute("title", "API Key missing");
            statusText.innerHTML = "AI Assistant &bull; Key Required";
            if (keyInput) keyInput.value = "";
        }
    }

    function getTime() {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    function scrollBottom() {
        chatBox.scrollTo({
            top: chatBox.scrollHeight,
            behavior: "smooth"
        });
    }

    function cleanText(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    function formatText(text) {
        if (!text) return "";
        let html = cleanText(text);

        html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
        });

        html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
        html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
        html = html.replace(/(?:^|\n)[*-] (.*?)(?=(?:\n[*-] )|\n\n|$)/g, "\n<li>$1</li>");
        html = html.replace(/((?:<li>.*?<\/li>\s*)+)/g, "<ul>$1</ul>");
        html = html.replace(/\n(?!(?:<\/ul>|<\/pre>|<li>))/g, "<br>");

        return html;
    }

    function addMessage(sender, text, isError = false) {
        const time = getTime();
        const row = document.createElement("div");
        row.className = `message-row ${sender === "user" ? "user-row" : "bot-row"}`;

        if (sender === "user") {
            row.innerHTML = `
                <div class="msg-avatar user-avatar-small">
                    <i class="bi bi-person-fill"></i>
                </div>
                <div class="message-content">
                    <div class="message-bubble user-bubble">
                        <p class="mb-0">${cleanText(text)}</p>
                    </div>
                    <div class="message-meta">
                        <span class="message-time">${time}</span>
                    </div>
                </div>
            `;
        } else {
            const content = isError 
                ? `<span class="text-danger"><i class="bi bi-exclamation-triangle me-1"></i>${cleanText(text)}</span>` 
                : formatText(text);

            row.innerHTML = `
                <div class="msg-avatar bot-avatar-small ${isError ? 'border-danger text-danger' : ''}">
                    <i class="bi bi-robot"></i>
                </div>
                <div class="message-content">
                    <div class="message-bubble bot-bubble ${isError ? 'border-danger' : ''}">
                        ${content}
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

            const copyButton = row.querySelector(".copy-btn");
            if (copyButton) {
                copyButton.addEventListener("click", () => {
                    navigator.clipboard.writeText(text).then(() => {
                        copyButton.innerHTML = `<i class="bi bi-check2 text-success"></i>`;
                        setTimeout(() => {
                            copyButton.innerHTML = `<i class="bi bi-copy"></i>`;
                        }, 2000);
                    });
                });
            }
        }

        messageList.appendChild(row);
        scrollBottom();
    }

    function showLoading() {
        loading.classList.remove("d-none");
        scrollBottom();
    }

    function hideLoading() {
        loading.classList.add("d-none");
    }

    function setLoading(isLoading) {
        if (isLoading) {
            showLoading();
            sendButton.disabled = true;
            input.disabled = true;
        } else {
            hideLoading();
            sendButton.disabled = false;
            input.disabled = false;
            input.focus();
        }
    }

    async function sendMessage(userText) {
        const key = getKey();

        if (!key || key.trim() === "") {
            addMessage("bot", "Please configure your Google Gemini API key to start chatting. Click the 'API Key' button in the top right.", true);
            if (keyModal) {
                keyModal.show();
            }
            return;
        }

        if (welcome) {
            welcome.style.display = "none";
        }

        addMessage("user", userText);

        history.push({
            role: "user",
            parts: [{ text: userText }]
        });

        setLoading(true);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key.trim()}`;

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: history,
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1000
                    }
                })
            });

            const data = await res.json();

            if (!res.ok) {
                const errorText = data.error?.message || `Error ${res.status}: Failed to get response.`;
                addMessage("bot", `Gemini API Error: ${errorText}`, true);
                history.pop();
                return;
            }

            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (reply) {
                history.push({
                    role: "model",
                    parts: [{ text: reply }]
                });
                addMessage("bot", reply);
            } else {
                addMessage("bot", "No response received. The output may have been filtered.", true);
            }

        } catch (err) {
            console.error(err);
            addMessage("bot", `Network Error: ${err.message || "Failed to connect to the Gemini API."}`, true);
            history.pop();
        } finally {
            setLoading(false);
        }
    }

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;

        input.value = "";
        sendMessage(text);
    });

    chips.forEach(chip => {
        chip.addEventListener("click", () => {
            const prompt = chip.getAttribute("data-prompt") || chip.innerText.trim();
            sendMessage(prompt);
        });
    });

    clearButton.addEventListener("click", () => {
        messageList.innerHTML = "";
        history = [];
        if (welcome) {
            welcome.style.display = "block";
        }
        input.value = "";
        input.focus();
    });

    saveKeyButton.addEventListener("click", () => {
        const key = keyInput.value.trim();
        if (key) {
            localStorage.setItem(API_KEY, key);
            updateKeyUI();
            if (keyModal) keyModal.hide();
            addMessage("bot", "API Key saved successfully! How can I help you today? 😊");
        } else {
            alert("Please enter an API key.");
        }
    });

    removeKeyButton.addEventListener("click", () => {
        if (confirm("Are you sure you want to remove your saved API key?")) {
            localStorage.removeItem(API_KEY);
            updateKeyUI();
            if (keyModal) keyModal.hide();
            addMessage("bot", "API Key removed. You will need to provide an API key to chat with Novis Bot.", true);
        }
    });

    toggleKeyButton.addEventListener("click", () => {
        const isPassword = keyInput.type === "password";
        keyInput.type = isPassword ? "text" : "password";
        toggleKeyIcon.className = isPassword ? "bi bi-eye-slash" : "bi bi-eye";
    });

    updateKeyUI();
    input.focus();
});
