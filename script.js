const API_KEY = "YOUR_GEMINI_API_KEY";
const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;



function sendBtn() {
    let userInput = document.getElementById("userInput");

    if (userInput.value === "") {
        alert("Please enter a message.");
    } else {
        let response = fetch(URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "contents": [
                    {
                        "parts": [
                            {
                                "text": userInput.value
                            }
                        ]
                    }
                ]
            })
        });

        console.log(response);

        response.then(res => res.json()).then(data => {
            displayResponse(data.candidates[0].content.parts[0].text);
        });
    }
}

function displayResponse(response) {
    let responseContainer = document.getElementById("responseContainer");
    responseContainer.innerHTML = response;
}
