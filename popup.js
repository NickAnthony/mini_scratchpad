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

const SPREADSHEET_ID = "142Uk39KQFQ6dI3nk8wybpB3OWt9zHIRMaA2ap1l3rX8";

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

const getSheetIdFromTitle = async (title) => {
  try {
    const spreadsheetId = SPREADSHEET_ID; // Replace with your actual spreadsheet ID
    const response = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId,
    });

    const sheets = response.result.sheets;

    for (const sheet of sheets) {
      if (sheet.properties.title === title) {
        const sheetId = sheet.properties.sheetId;
        console.log(`Sheet ID of ${title} is ${sheetId}`);
        return sheetId;
      }
    }

    console.log("Sheet not found");
  } catch (error) {
    console.error("Error finding sheet:", error);
  }

  return null;
};

const createSheet = async (sheetTitle) => {
  try {
    const spreadsheetId = SPREADSHEET_ID;

    // First, check if the sheet already exists
    const existingSheet = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId,
    });

    const sheets = existingSheet.result.sheets;
    const sheetExists = sheets.some(
      (sheet) => sheet.properties.title === sheetTitle
    );

    if (sheetExists) {
      console.log('Sheet "Personal CRM" already exists.');
      for (const sheet of sheets) {
        if (sheet.properties.title === title) {
          const sheetId = sheet.properties.sheetId;
          return sheetId;
        }
      }
    }

    // If the sheet does not exist, create a new one
    const requests = [
      {
        addSheet: {
          properties: {
            title: sheetTitle,
          },
        },
      },
    ];

    const batchUpdateRequest = {
      requests,
    };

    // Send the request to create the sheet
    const response = await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: batchUpdateRequest,
    });

    console.log('Sheet "Personal CRM" created successfully.');
    return response.sheetId;
  } catch (error) {
    console.error("Error creating sheet:", error);
  }
};

const saveToSheets = async (row) => {
  console.log(`Received data in saveToSheets:`, row);
  if (!Array.isArray(row) || row.length < 2) {
    console.error("Invalid or incomplete data received in saveToSheets", row);
    return;
  }

  console.log(`saveToSheet: ${row}`);
  const action = row[1];
  let sheetTitle = action;
  if (action === "Personal CRM") {
    // Check if there is a sheet named "Personal CRM"
    getSheetIdFromTitle("Personal CRM").then((sheetId) => {
      if (sheetId) {
        // If so, append to it
        appendToSheet(row, "Personal CRM").then(
          function () {
            setStatus("Successfully appended row");
          },
          function (response) {
            setStatus("Error appnding row");
            console.log(response);
          }
        );
      } else {
        createSheet("Personal CRM").then(() => {
          // Then append to it
          appendToSheet(row, "Personal CRM").then(
            function () {
              setStatus("Successfully appended row");
            },
            function (response) {
              setStatus("Error appnding row");
              console.log(response);
            }
          );
        });
      }
    });
    setLoading(false);

    return;
  } else {
    sheetTitle = "Activities";
  }

  try {
    const sheetId = await getSheetIdFromTitle(sheetTitle);
    if (!sheetId) {
      await createSheet(sheetTitle);
    }

    // Retrieve headers from the sheet to map data correctly
    const headers = await getSheetHeaders(sheetId, sheetTitle);
    const dataMappedToHeaders = mapDataToHeaders(headers, row);

    // Append the mapped data to the sheet
    await appendToSheet(dataMappedToHeaders, sheetTitle);
    setStatus("Successfully appended row");
  } catch (error) {
    setStatus("Error appending row");
    console.error(error);
  }

  setTimeout(function () {
    setStatus("Working.  Let's do some outreach!");
  }, 5000);
};

function getSheetHeaders(sheetId, sheetTitle) {
  return gapi.client.sheets.spreadsheets.values
    .get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetTitle}!1:1`, // Assuming headers are in the first row
    })
    .then((response) => {
      return response.result.values[0]; // Returns the headers as an array
    });
}

function mapDataToHeaders(headers, rowData) {
  const dataObject = {
    timestamp: rowData[0],
    type: rowData[1],
    url: rowData[2],
    name: rowData[3],
    title: rowData[4],
    company: rowData[5],
    email: rowData[6],
  };

  // Map data to headers order
  return headers.map((header) => dataObject[header] || "");
}

function setStatus(status) {
  document.getElementById("status").innerText = "Status: " + status;
}

function setLoading(status) {
  if (status == true) {
    document.getElementById("loader").style.display = "block";
  } else {
    document.getElementById("loader").style.display = "none";
  }
}

function appendToSheet(row, sheetTitle) {
  var rangeEnd = String.fromCharCode("A".charCodeAt(0) + row.length);
  if (sheetTitle) {
    var appendParams = {
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetTitle}!A:${rangeEnd}`,
      valueInputOption: "RAW",
    };
  } else {
    var appendParams = {
      spreadsheetId: SPREADSHEET_ID,
      range: "A:" + rangeEnd,
      valueInputOption: "RAW",
    };
  }

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

function getTabContent() {
  return new Promise((resolve, reject) => {
    chrome.tabs.executeScript(
      {
        code: "document.documentElement.outerHTML;",
      },
      function (results) {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              "Error in executing script: " + chrome.runtime.lastError.message
            )
          );
        } else if (results && results[0]) {
          resolve(results[0]);
        } else {
          reject(new Error("No result returned from script execution"));
        }
      }
    );
  });
}

function parseOutLinkedInProfile() {
  const nameClassIdentifier = ".artdeco-entity-lockup__title";
  const titleClassIdentifier = ".artdeco-entity-lockup__subtitle";
  const currentCompanyAriaLabelItentifier = "Current company: ";
  return new Promise((resolve, reject) => {
    getTabContent()
      .then((html) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // Parse out the name
        const nameElement = doc.querySelector(nameClassIdentifier);
        let name = "";
        if (nameElement) {
          name = nameElement.textContent || "";
          const span = nameElement.querySelector("span");
          if (span) {
            name = name.replace(span.textContent, "");
          }
          name = name.replace(/\s+/g, " ").trim();
        }

        // Parse out the title
        const titleElement = doc.querySelector(titleClassIdentifier);
        let title = "";
        if (titleElement) {
          title = titleElement.textContent || "";
          const span = titleElement.querySelector("span");
          if (span) {
            title = title
              .replace(span.textContent, "")
              .replace(/\s+/g, " ")
              .trim();
          }
          title = title.replace(/\s+/g, " ").trim();
        }

        // Parse out the company
        const companyButton = doc.querySelector(
          `button[aria-label^="${currentCompanyAriaLabelItentifier}"]`
        );
        let company = "";
        if (companyButton) {
          const fullAriaLabel = companyButton.getAttribute("aria-label");
          const start = currentCompanyAriaLabelItentifier.length;
          const end = fullAriaLabel.indexOf(".", start);
          company = fullAriaLabel.substring(start, end).trim();
        }

        resolve([name, title, company]);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

function parseOutLinkedInSalesNavProfile() {
  const nameParamIdentifier = '[data-anonymize="person-name"]';
  const jobTitleParamIdentifier = '[data-anonymize="job-title"]';
  const currentCompanyParamItentifier = '[data-anonymize="company-name"]';
  const linkedInProfileHrefIdentifier =
    'a[href^="https://www.linkedin.com/in/"]';
  const emailParamIdentifier = '[data-anonymize="email"]';
  return new Promise((resolve, reject) => {
    getTabContent()
      .then((html) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // Parse out the name
        const nameElement = doc.querySelector(nameParamIdentifier);
        let name = "";
        if (nameElement) {
          name = nameElement.textContent || "";
          name = name.replace(/\s+/g, " ").trim();
        }

        // Parse out the job title
        const titleElement = doc.querySelector(jobTitleParamIdentifier);
        let title = "";
        if (titleElement) {
          title = titleElement.textContent || "";
          title = title.replace(/\s+/g, " ").trim();
        }

        // Parse out the company
        const companyElement = doc.querySelector(currentCompanyParamItentifier);
        let company = "";
        if (companyElement) {
          company = companyElement.textContent || "";
          company = company.replace(/\s+/g, " ").trim();
        }

        // Parse out the email
        const emailElement = doc.querySelector(emailParamIdentifier);
        let email = "";
        if (emailElement) {
          email = emailElement.textContent || "";
          email = email.replace(/\s+/g, " ").trim();
        }

        // Parse out the LinkedIn profile URL
        const linkedInProfileElement = doc.querySelector(
          linkedInProfileHrefIdentifier
        );
        let linkedInProfileUrl = "";
        if (linkedInProfileElement) {
          const fullHref = linkedInProfileElement.getAttribute("href");
          linkedInProfileUrl = fullHref.split("?")[0] + "/"; // Extract the base URL without parameters
        }

        resolve([name, title, company, email, linkedInProfileUrl]);
      })
      .catch((error) => {
        reject(error);
      });
  });
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

  getCurrentTabUrl()
    .then((url) => {
      if (dataType === "Personal CRM") {
        const meet = document.getElementById("personalCRMMeet").value;
        const details = document.getElementById("personalCRMDetails").value;

        return [humanReadableDate, dataType, url, meet, details];
      }

      if (url.includes("https://www.linkedin.com/in/")) {
        return parseOutLinkedInProfile().then((data) => {
          return [humanReadableDate, dataType, url, ...data];
        });
      }

      if (url.includes("https://www.linkedin.com/sales/lead/")) {
        return parseOutLinkedInSalesNavProfile().then((data) => {
          const linkedInUrl = data.pop(); // Remove the URL from the data array
          if (linkedInUrl) {
            url = linkedInUrl;
          }
          return [humanReadableDate, dataType, url, ...data];
        });
      }

      return [humanReadableDate, dataType, url];
    })
    .then((data) => {
      saveToSheets(data); // Moved this line inside the then() to ensure data is available
    })
    .catch((error) => {
      console.error("Error getting tab URL: ", error);
    })
    .finally(() => {
      setLoading(false);
    });
};

document
  .getElementById("linkedInDM")
  .addEventListener("click", function (event) {
    setLoading(true);
    const data = getData("LinkedIn DM Prospecting", prompt);
    event.target.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
  });

document
  .getElementById("linkedInParse")
  .addEventListener("click", function (event) {
    setLoading(true);
    parseOutLinkedInProfile();
    event.target.blur(); // Makes button responsive (focus remains during call to saveToSheets)
  });

document
  .getElementById("linkedInFollowup")
  .addEventListener("click", function (event) {
    setLoading(true);
    const prompt =
      "Given the following page text from a linkedin page, please give me the name, title, and company of this person, delimited by the '^' character. If you can't figure out any of the values, use None.\n\nText Content:";
    const data = getData("LinkedIn Follow Up DM Prospecting", prompt);
    event.target.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
  });

document
  .getElementById("warmIntro")
  .addEventListener("click", function (event) {
    setLoading(true);
    const prompt = "";
    const data = getData("Warm Intro Connector Prospecting", prompt);
    event.target.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
  });

document.getElementById("emailed").addEventListener("click", function (event) {
  setLoading(true);
  const prompt = "";
  const data = getData("Emailed Prospecting", prompt);
  event.target.blur(); // Makes button responsive (focus remains during call to saveToSheets)
  saveToSheets(data);
});

document
  .getElementById("followOnLI")
  .addEventListener("click", function (event) {
    setLoading(true);
    const prompt = "";
    const data = getData("LinkedIn Follow Prospecting", prompt);
    event.target.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
  });

document
  .getElementById("ycCofounder")
  .addEventListener("click", function (event) {
    const prompt = "";
    const data = getData("YC Cofounder Match Prospecting", prompt);
    event.target.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
  });

document
  .getElementById("cambrianCofounder")
  .addEventListener("click", function (event) {
    setLoading(true);
    const prompt = "";
    const data = getData("Cambrian Cofounder Match Prospecting", prompt);
    event.target.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
  });

document
  .getElementById("linkedInDMRecruiting")
  .addEventListener("click", function (event) {
    setLoading(true);
    const prompt =
      "Given the following page text from a linkedin page, please give me the name, title, and company of this person, delimited by the '^' character. If you can't figure out any of the values, use None.\n\nText Content:";
    const data = getData("LinkedIn DM Recruiting", prompt);
    event.target.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
  });

document
  .getElementById("warmIntroRecruiting")
  .addEventListener("click", function (event) {
    setLoading(true);
    const prompt = "";
    const data = getData("Warm Intro Connector Recruiting", prompt);
    saveToSheets(data);
    event.target.blur(); // Makes button responsive (focus remains during call to saveToSheets)
  });

document
  .getElementById("emailedRecruiting")
  .addEventListener("click", function (event) {
    setLoading(true);
    const prompt = "";
    const data = getData("Emailed Recruiting", prompt);
    event.target.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
  });

document
  .getElementById("followOnLIRecruiting")
  .addEventListener("click", function (event) {
    setLoading(true);
    const prompt = "";
    const data = getData("LinkedIn Follow Recruiting", prompt);
    event.target.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
  });

document
  .getElementById("ycCofounderRecruiting")
  .addEventListener("click", function (event) {
    setLoading(true);
    const prompt = "";
    const data = getData("YC Cofounder Match Recruiting", prompt);
    saveToSheets(data);
    event.target.blur(); // Makes button responsive (focus remains during call to saveToSheets)
  });

document
  .getElementById("cambrianCofounderRecruiting")
  .addEventListener("click", function (event) {
    setLoading(true);
    const prompt = "";
    const data = getData("Cambrian Cofounder Match Recruiting", prompt);
    event.target.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
  });

document
  .getElementById("saveToPersonalCRM")
  .addEventListener("click", function (event) {
    setLoading(true);
    const prompt = "";
    const data = getData("Personal CRM", prompt);
    event.target.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
    document.getElementById("personalCRMMeet").innerText = "";
    document.getElementById("personalCRMDetails").innerText = "";
  });

document.getElementById("openSheet").addEventListener("click", function () {
  chrome.tabs.create({
    url: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`,
  });
});
