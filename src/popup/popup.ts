// Schema is
// timestamp, type, url, name, title, company

function signin() {
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
}
signin();

const SPREADSHEET_ID = "1_JEoi7MnrRqYHQhdq-Rdhqz13OX9ckC14VmKRn3nOqA";

async function getSheetIdFromTitle(title: string): Promise<number | null> {
  try {
    const spreadsheetId = SPREADSHEET_ID; // Replace with your actual spreadsheet ID
    const response = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId,
    });

    const sheets = response.result.sheets;

    if (!sheets) return null;

    for (const sheet of sheets) {
      if (sheet.properties && sheet.properties.title === title) {
        const sheetId = sheet.properties.sheetId;
        console.log("FOUND SHEET ID: ", sheetId);
        return sheetId ?? null;
      }
    }

    console.log("Sheet not found");
  } catch (error) {
    console.error("Error finding sheet:", error);
  }

  return null;
}

async function createSheet(sheetTitle: string): Promise<number | null> {
  try {
    console.log(`createSheet(${sheetTitle})`);
    const spreadsheetId = SPREADSHEET_ID;

    // First, check if the sheet already exists
    const existingSheet = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId,
    });

    const sheets = existingSheet.result.sheets;
    console.log(`createSheet - sheets: ${JSON.stringify(sheets)}`);
    const sheetExists = sheets?.some(
      (sheet) => sheet.properties?.title === sheetTitle
    );

    console.log(`createSheet - sheetExists: ${sheetExists}`);

    if (sheetExists) {
      console.log('Sheet "Personal CRM" already exists.');
      if (!sheets) return null;
      for (const sheet of sheets) {
        if (sheet.properties?.title === sheetTitle) {
          const sheetId = sheet.properties.sheetId;
          console.log(`Sheet ID: ${sheetId}`);
          return sheetId ?? null;
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
    let sheetId: number | null = null;
    const replies = response.result.replies;
    if (replies && replies[0]?.addSheet?.properties?.sheetId) {
      sheetId = replies[0].addSheet.properties.sheetId;
    }
    return sheetId;
  } catch (error) {
    console.error("Error creating sheet:", error);
    return null;
  }
}

async function saveToSheets(data: Data) {
  console.log(`saveToSheet: ${data}`);

  if (data.dataType === "Personal CRM") {
    const rowData = [data.humanReadableDate, data.dataType, data.url];
    if (data.meet) rowData.push(data.meet);
    if (data.details) rowData.push(data.details);
    // Check if there is a sheet named "Personal CRM"
    getSheetIdFromTitle("Personal CRM").then((sheetId) => {
      if (sheetId) {
        // If so, append to it
        appendToSheet(rowData, "Personal CRM").then(
          function () {
            setStatus("Successfully appended row");
          },
          function (response) {
            setStatus("Error appnding row");
            console.error(response);
          }
        );
      } else {
        createSheet("Personal CRM").then(() => {
          // Then append to it
          appendToSheet(rowData, "Personal CRM").then(
            function () {
              setStatus("Successfully appended row");
            },
            function (response) {
              setStatus("Error appnding row");
              console.error(response);
            }
          );
        });
      }
    });
    setLoading(false);

    return;
  }

  try {
    let sheetTitle = "Activities";
    let sheetId = await getSheetIdFromTitle(sheetTitle);
    if (!sheetId) {
      sheetId = await createSheet(sheetTitle);
    }
    if (!sheetId && sheetId !== 0) {
      setStatus("Error finding or creating sheet");
      return;
    }

    // Retrieve headers from the sheet to map data correctly
    const headers = await getSheetHeaders(sheetId, sheetTitle);
    const dataMappedToHeaders = mapDataToHeaders(headers, data);

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
}

function getSheetHeaders(
  sheetId: number,
  sheetTitle: string
): Promise<string[]> {
  return gapi.client.sheets.spreadsheets.values
    .get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetTitle}!1:1`, // Assuming headers are in the first row
    })
    .then((response) => {
      if (!response.result.values) {
        return [];
      } else {
        const values: string[] = response.result.values[0];
        return values; // Returns the headers as an array
      }
    });
}

function mapDataToHeaders(headers: string[], rowData: Data) {
  const dataObject: Record<string, string> = {
    timestamp: rowData.humanReadableDate,
    type: rowData.dataType,
    url: rowData.url,
    name: rowData.name ?? "",
    title: rowData.title ?? "",
    company: rowData.company ?? "",
    email: rowData.email ?? "",
    message: rowData.message ?? "",
  };

  // Map data to headers order
  return headers.map((header) => dataObject[header] || "");
}

function setStatus(status: string) {
  const statusElement = document.getElementById("status");
  if (statusElement) {
    statusElement.innerText = "Status: " + status;
  }
}

function setLoading(status: boolean) {
  const loadingElement = document.getElementById("loader");
  if (loadingElement) {
    loadingElement.style.display = status ? "block" : "none";
  }
}

function appendToSheet(row: string[], sheetTitle: string) {
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

  return gapi.client.sheets.spreadsheets.values.append(
    appendParams,
    valueRangeBody
  );
}

async function getCurrentTabUrl(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs && tabs.length > 0) {
        resolve(tabs[0].url ?? null);
      } else {
        reject(new Error("No active tab found"));
      }
    });
  });
}

async function getTabContent(): Promise<string> {
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

interface LinkedInProfileData {
  name: string;
  title: string;
  company: string;
  linkedInProfileUrl?: string;
  email?: string;
}
async function parseOutLinkedInProfile(): Promise<LinkedInProfileData> {
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
            name = name.replace(span.textContent ?? "", "");
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
              .replace(span.textContent ?? "", "")
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
          const end = fullAriaLabel?.indexOf(".", start);
          company = fullAriaLabel?.substring(start, end).trim() ?? "";
        }

        resolve({ name, title, company });
      })
      .catch((error) => {
        reject(error);
      });
  });
}

async function parseOutLinkedInSalesNavProfile(): Promise<LinkedInProfileData> {
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
          linkedInProfileUrl = fullHref?.split("?")[0] + "/"; // Extract the base URL without parameters
        }
        resolve({ name, title, company, email, linkedInProfileUrl });
      })
      .catch((error) => {
        reject(error);
      });
  });
}

interface Data {
  humanReadableDate: string;
  dataType: string;
  url: string;
  meet?: string;
  details?: string;
  name?: string;
  title?: string;
  company?: string;
  linkedInProfileUrl?: string;
  email?: string;
  message?: string;
}
async function getData(dataType: string): Promise<Data> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const humanReadableDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

  try {
    let url = await getCurrentTabUrl();

    if (!url) {
      throw new Error("No URL found");
    }

    if (dataType === "Personal CRM") {
      const meetElement = document.getElementById(
        "personalCRMMeet"
      ) as HTMLTextAreaElement;
      const meet = meetElement ? meetElement.value : "";
      const detailsElement = document.getElementById(
        "personalCRMDetails"
      ) as HTMLTextAreaElement;
      const details = detailsElement ? detailsElement.value : "";

      return { humanReadableDate, dataType, url, meet, details };
    }

    const messageElement = document.getElementById(
      "prospectMessage"
    ) as HTMLTextAreaElement;
    const message = messageElement ? messageElement.value : "";

    if (url?.includes("https://www.linkedin.com/in/")) {
      const data = await parseOutLinkedInProfile();
      return { humanReadableDate, dataType, url, ...data, message };
    }

    if (url?.includes("https://www.linkedin.com/sales/lead/")) {
      const data = await parseOutLinkedInSalesNavProfile();
      if (data.linkedInProfileUrl) {
        url = data.linkedInProfileUrl ?? url;
      }
      return { humanReadableDate, dataType, url, ...data, message };
    }

    return { humanReadableDate, dataType, url, message };
  } catch {
    return { humanReadableDate, dataType, url: "" };
  } finally {
    setLoading(false);
  }
}

function clearProspectMessage() {
  const messageElement = document.getElementById(
    "prospectMessage"
  ) as HTMLTextAreaElement;
  if (messageElement) messageElement.value = "";
}

document
  .getElementById("linkedInDM")
  ?.addEventListener("click", async function (event) {
    setLoading(true);
    const data = await getData("LinkedIn DM Prospecting");
    (event.target as HTMLElement)?.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
  });

document
  .getElementById("linkedInFollowup")
  ?.addEventListener("click", async function (event) {
    setLoading(true);
    const data = await getData("LinkedIn Follow Up DM Prospecting");
    (event.target as HTMLElement)?.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
    clearProspectMessage();
  });

document
  .getElementById("warmIntro")
  ?.addEventListener("click", async function (event) {
    setLoading(true);
    const data = await getData("Warm Intro Connector Prospecting");
    (event.target as HTMLElement)?.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
    clearProspectMessage();
  });

document
  .getElementById("emailed")
  ?.addEventListener("click", async function (event) {
    setLoading(true);
    const data = await getData("Emailed Prospecting");
    (event.target as HTMLElement)?.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
    clearProspectMessage();
  });

document
  .getElementById("followOnLI")
  ?.addEventListener("click", async function (event) {
    setLoading(true);
    const data = await getData("LinkedIn Follow Prospecting");
    (event.target as HTMLElement)?.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
    clearProspectMessage();
  });

document
  .getElementById("ycCofounder")
  ?.addEventListener("click", async function (event) {
    const data = await getData("YC Cofounder Match Prospecting");
    (event.target as HTMLElement)?.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
  });

document
  .getElementById("cambrianCofounder")
  ?.addEventListener("click", async function (event) {
    setLoading(true);
    const data = await getData("Cambrian Cofounder Match Prospecting");
    (event.target as HTMLElement)?.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
  });

document
  .getElementById("linkedInDMRecruiting")
  ?.addEventListener("click", async function (event) {
    setLoading(true);
    const data = await getData("LinkedIn DM Recruiting");
    (event.target as HTMLElement)?.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
    clearProspectMessage();
  });

document
  .getElementById("warmIntroRecruiting")
  ?.addEventListener("click", async function (event) {
    setLoading(true);
    const data = await getData("Warm Intro Connector Recruiting");
    saveToSheets(data);
    (event.target as HTMLElement)?.blur(); // Makes button responsive (focus remains during call to saveToSheets)
  });

document
  .getElementById("emailedRecruiting")
  ?.addEventListener("click", async function (event) {
    setLoading(true);
    const data = await getData("Emailed Recruiting");
    (event.target as HTMLElement)?.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
  });

document
  .getElementById("followOnLIRecruiting")
  ?.addEventListener("click", async function (event) {
    setLoading(true);
    const data = await getData("LinkedIn Follow Recruiting");
    (event.target as HTMLElement)?.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
  });

document
  .getElementById("ycCofounderRecruiting")
  ?.addEventListener("click", async function (event) {
    setLoading(true);
    const data = await getData("YC Cofounder Match Recruiting");
    saveToSheets(data);
    (event.target as HTMLElement)?.blur(); // Makes button responsive (focus remains during call to saveToSheets)
  });

document
  .getElementById("cambrianCofounderRecruiting")
  ?.addEventListener("click", async function (event) {
    setLoading(true);
    const data = await getData("Cambrian Cofounder Match Recruiting");
    (event.target as HTMLElement)?.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
  });

document
  .getElementById("saveToPersonalCRM")
  ?.addEventListener("click", async function (event) {
    setLoading(true);
    const data = await getData("Personal CRM");
    (event.target as HTMLElement)?.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
    const personalCRMMeetElement = document.getElementById("personalCRMMeet");
    if (personalCRMMeetElement) {
      personalCRMMeetElement.innerText = "";
    }
    const personalCRMDetailsElement =
      document.getElementById("personalCRMDetails");
    if (personalCRMDetailsElement) {
      personalCRMDetailsElement.innerText = "";
    }
  });

document.getElementById("openSheet")?.addEventListener("click", function () {
  chrome.tabs.create({
    url: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`,
  });
});
