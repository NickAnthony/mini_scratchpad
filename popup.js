// Schema is
// timestamp, type, url, name, title, company

const signin = () => {
  chrome.identity.getAuthToken({ interactive: true }, function (token) {
    if (token === undefined) {
      setStatus("Error authenticating with Google Drive");
      console.log("Error authenticating with Google Drive");
    } else {
      gapi.load("client", function () {
        gapi.client.setToken({ access_token: token });
        gapi.client.load("drive", "v3", function () {
          gapi.client.load("sheets", "v4", function () {
            // main();
          });
        });
      });
    }
  });
};
signin();

const SHEETID = "142Uk39KQFQ6dI3nk8wybpB3OWt9zHIRMaA2ap1l3rX8";

const callGPT4 = (prompt) => {
  var apiUrl = "https://api.openai.com/v1/chat/completions"; // This URL might change, so make sure to get the correct endpoint from OpenAI's official documentation

  var headers = {
    Authorization: "Bearer sk-<insert open ai key>", // replace with your OpenAI API Key
    "Content-Type": "application/json",
  };

  var payload = {
    model: "gpt-4",
    messages: [{ role: "user", content: `${prompt}` }],
    max_tokens: 256,
    temperature: 0,
  };

  var options = {
    method: "POST",
    headers: headers,
    muteHttpExceptions: true,
    body: JSON.stringify(payload),
  };

  fetch(apiUrl, options)
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      const answer = data["choices"][0].message.content;
      return answer;
    })
    .catch((error) => {
      console.log("Something bad happened " + error);
      return "";
    });
};

const saveToSheets = (row) => {
  // data = { timestamp, type, url, name, title, company }

  console.log("!!!!");
  console.log(row);

  appendToSheet(row).then(
    function () {
      setStatus("Successfully appended row");
    },
    function (response) {
      setStatus("Error appnding row");
      console.log(response);
    }
  );
};

function setStatus(status) {
  document.getElementById("status").innerText = status;
}

function appendToSheet(row) {
  var rangeEnd = String.fromCharCode("A".charCodeAt(0) + row.length);
  var appendParams = {
    spreadsheetId: SHEETID,
    range: "A:" + rangeEnd,
    valueInputOption: "RAW",
  };
  var valueRangeBody = {
    majorDimension: "ROWS",
    values: [row],
  };
  // alert("appending")
  return gapi.client.sheets.spreadsheets.values.append(
    appendParams,
    valueRangeBody
  );
}

const getData = (dataType, prompt) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const humanReadableDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

  function getCurrentTabUrl() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs.length > 0) {
          resolve(tabs[0].url);
        } else {
          reject(new Error("No active tab found"));
        }
      });
    });
  }

  getCurrentTabUrl()
    .then((url1) => {
      console.log("url1");
      console.log(url1);

      // Now that we have the URL, we can do other things
      // For example, your original code attempted to extract page text
      // and further process it with GPT-4, but those steps are not included here.

      // TODO: The problem is that I can't get the active tab's html...
      // debugger
      // const profileText = document.querySelector("section[data-member-id]").textContent.replaceAll("\n", "")
      // const answer = callGPT4(`${prompt}\n${profileText}`)
      // debugger

      return [humanReadableDate, dataType, url1];
    })
    .then((data) => {
      saveToSheets(data); // Moved this line inside the then() to ensure data is available
    })
    .catch((error) => {
      console.error("Error getting tab URL: ", error);
    });
};

document.getElementById("Sign In").addEventListener("click", function () {
  signin();
});

document.getElementById("linkedInDM").addEventListener("click", function () {
  const prompt =
    "Given the following page text from a linkedin page, please give me the name, title, and company of this person, delimited by the '^' character. If you can't figure out any of the values, use None.\n\nText Content:";
  const data = getData("LinkedIn DM Prospecting", prompt);

  saveToSheets(data);
});

document.getElementById("warmIntro").addEventListener("click", function () {
  const prompt = "";
  const data = getData("Warm Intro Connector Prospecting", prompt);
  saveToSheets(data);
});

document.getElementById("emailed").addEventListener("click", function () {
  const prompt = "";
  const data = getData("Emailed Prospecting", prompt);
  saveToSheets(data);
});

document.getElementById("followOnLI").addEventListener("click", function () {
  const prompt = "";
  const data = getData("LinkedIn Follow Prospecting", prompt);
  saveToSheets(data);
});

document.getElementById("ycCofounder").addEventListener("click", function () {
  const prompt = "";
  const data = getData("YC Cofounder Match Prospecting", prompt);
  saveToSheets(data);
});

document
  .getElementById("cambrianCofounder")
  .addEventListener("click", function () {
    const prompt = "";
    const data = getData("Cambrian Cofounder Match Prospecting", prompt);
    saveToSheets(data);
  });

document
  .getElementById("linkedInDMRecruiting")
  .addEventListener("click", function () {
    const prompt =
      "Given the following page text from a linkedin page, please give me the name, title, and company of this person, delimited by the '^' character. If you can't figure out any of the values, use None.\n\nText Content:";
    const data = getData("LinkedIn DM Recruiting", prompt);

    saveToSheets(data);
  });

document
  .getElementById("warmIntroRecruiting")
  .addEventListener("click", function () {
    const prompt = "";
    const data = getData("Warm Intro Connector Recruiting", prompt);
    saveToSheets(data);
  });

document
  .getElementById("emailedRecruiting")
  .addEventListener("click", function () {
    const prompt = "";
    const data = getData("Emailed Recruiting", prompt);
    saveToSheets(data);
  });

document
  .getElementById("followOnLIRecruiting")
  .addEventListener("click", function () {
    const prompt = "";
    const data = getData("LinkedIn Follow Recruiting", prompt);
    saveToSheets(data);
  });

document
  .getElementById("ycCofounderRecruiting")
  .addEventListener("click", function () {
    const prompt = "";
    const data = getData("YC Cofounder Match Recruiting", prompt);
    saveToSheets(data);
  });

document
  .getElementById("cambrianCofounderRecruiting")
  .addEventListener("click", function () {
    const prompt = "";
    const data = getData("Cambrian Cofounder Match Recruiting", prompt);
    saveToSheets(data);
  });