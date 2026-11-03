const API_KEY = "YOUR_GEMINI_API_KEY";
const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${API_KEY}`



function sendBtn() {
    let userInput = document.getElementById("userInput");

    if (userInput.value === "") {
        alert("Please enter a message.");
    } else if (API_KEY === "YOUR_GEMINI_API_KEY") {
        alert("Please configure your Gemini API key in script.js.");
    } else {
      const response = fetch(URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "prompt": [{ parts: [{ "text": userInput.value }] }]
            })
            
        });
    }
}
