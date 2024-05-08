"use strict";
// Schema is
// timestamp, type, url, name, title, company
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
function signin() {
    chrome.identity.getAuthToken({ interactive: true }, function (token) {
        if (token === undefined) {
            setStatus("Error authenticating with Google Drive");
            console.log("Error authenticating with Google Drive");
        }
        else {
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
const SPREADSHEET_ID = "142Uk39KQFQ6dI3nk8wybpB3OWt9zHIRMaA2ap1l3rX8";
async function getSheetIdFromTitle(title) {
    try {
        const spreadsheetId = SPREADSHEET_ID; // Replace with your actual spreadsheet ID
        const response = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId,
        });
        const sheets = response.result.sheets;
        if (!sheets)
            return null;
        for (const sheet of sheets) {
            if (sheet.properties && sheet.properties.title === title) {
                const sheetId = sheet.properties.sheetId;
                console.log("FOUND SHEET ID: ", sheetId);
                return sheetId !== null && sheetId !== void 0 ? sheetId : null;
            }
        }
        console.log("Sheet not found");
    }
    catch (error) {
        console.error("Error finding sheet:", error);
    }
    return null;
}
async function createSheet(sheetTitle) {
    var _a, _b, _c, _d;
    try {
        console.log(`createSheet(${sheetTitle})`);
        const spreadsheetId = SPREADSHEET_ID;
        // First, check if the sheet already exists
        const existingSheet = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId,
        });
        const sheets = existingSheet.result.sheets;
        console.log(`createSheet - sheets: ${JSON.stringify(sheets)}`);
        const sheetExists = sheets === null || sheets === void 0 ? void 0 : sheets.some((sheet) => { var _a; return ((_a = sheet.properties) === null || _a === void 0 ? void 0 : _a.title) === sheetTitle; });
        console.log(`createSheet - sheetExists: ${sheetExists}`);
        if (sheetExists) {
            console.log('Sheet "Personal CRM" already exists.');
            if (!sheets)
                return null;
            for (const sheet of sheets) {
                if (((_a = sheet.properties) === null || _a === void 0 ? void 0 : _a.title) === sheetTitle) {
                    const sheetId = sheet.properties.sheetId;
                    console.log(`Sheet ID: ${sheetId}`);
                    return sheetId !== null && sheetId !== void 0 ? sheetId : null;
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
        let sheetId = null;
        const replies = response.result.replies;
        if (replies && ((_d = (_c = (_b = replies[0]) === null || _b === void 0 ? void 0 : _b.addSheet) === null || _c === void 0 ? void 0 : _c.properties) === null || _d === void 0 ? void 0 : _d.sheetId)) {
            sheetId = replies[0].addSheet.properties.sheetId;
        }
        return sheetId;
    }
    catch (error) {
        console.error("Error creating sheet:", error);
        return null;
    }
}
async function saveToSheets(data) {
    console.log(`saveToSheet: ${data}`);
    if (data.dataType === "Personal CRM") {
        const rowData = [data.humanReadableDate, data.dataType, data.url];
        if (data.meet)
            rowData.push(data.meet);
        if (data.details)
            rowData.push(data.details);
        // Check if there is a sheet named "Personal CRM"
        getSheetIdFromTitle("Personal CRM").then((sheetId) => {
            if (sheetId) {
                // If so, append to it
                appendToSheet(rowData, "Personal CRM").then(function () {
                    setStatus("Successfully appended row");
                }, function (response) {
                    setStatus("Error appnding row");
                    console.error(response);
                });
            }
            else {
                createSheet("Personal CRM").then(() => {
                    // Then append to it
                    appendToSheet(rowData, "Personal CRM").then(function () {
                        setStatus("Successfully appended row");
                    }, function (response) {
                        setStatus("Error appnding row");
                        console.error(response);
                    });
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
    }
    catch (error) {
        setStatus("Error appending row");
        console.error(error);
    }
    setTimeout(function () {
        setStatus("Working.  Let's do some outreach!");
    }, 5000);
}
function getSheetHeaders(sheetId, sheetTitle) {
    return gapi.client.sheets.spreadsheets.values
        .get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetTitle}!1:1`, // Assuming headers are in the first row
    })
        .then((response) => {
        if (!response.result.values) {
            return [];
        }
        else {
            const values = response.result.values[0];
            return values; // Returns the headers as an array
        }
    });
}
function mapDataToHeaders(headers, rowData) {
    var _a, _b, _c, _d;
    const dataObject = {
        timestamp: rowData.humanReadableDate,
        type: rowData.dataType,
        url: rowData.url,
        name: (_a = rowData.name) !== null && _a !== void 0 ? _a : "",
        title: (_b = rowData.title) !== null && _b !== void 0 ? _b : "",
        company: (_c = rowData.company) !== null && _c !== void 0 ? _c : "",
        email: (_d = rowData.email) !== null && _d !== void 0 ? _d : "",
    };
    // Map data to headers order
    return headers.map((header) => dataObject[header] || "");
}
function setStatus(status) {
    const statusElement = document.getElementById("status");
    if (statusElement) {
        statusElement.innerText = "Status: " + status;
    }
}
function setLoading(status) {
    const loadingElement = document.getElementById("loader");
    if (loadingElement) {
        loadingElement.style.display = status ? "block" : "none";
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
    }
    else {
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
    return gapi.client.sheets.spreadsheets.values.append(appendParams, valueRangeBody);
}
async function getCurrentTabUrl() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            var _a;
            if (tabs && tabs.length > 0) {
                resolve((_a = tabs[0].url) !== null && _a !== void 0 ? _a : null);
            }
            else {
                reject(new Error("No active tab found"));
            }
        });
    });
}
async function getTabContent() {
    return new Promise((resolve, reject) => {
        chrome.tabs.executeScript({
            code: "document.documentElement.outerHTML;",
        }, function (results) {
            if (chrome.runtime.lastError) {
                reject(new Error("Error in executing script: " + chrome.runtime.lastError.message));
            }
            else if (results && results[0]) {
                resolve(results[0]);
            }
            else {
                reject(new Error("No result returned from script execution"));
            }
        });
    });
}
async function parseOutLinkedInProfile() {
    const nameClassIdentifier = ".artdeco-entity-lockup__title";
    const titleClassIdentifier = ".artdeco-entity-lockup__subtitle";
    const currentCompanyAriaLabelItentifier = "Current company: ";
    return new Promise((resolve, reject) => {
        getTabContent()
            .then((html) => {
            var _a, _b, _c;
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            // Parse out the name
            const nameElement = doc.querySelector(nameClassIdentifier);
            let name = "";
            if (nameElement) {
                name = nameElement.textContent || "";
                const span = nameElement.querySelector("span");
                if (span) {
                    name = name.replace((_a = span.textContent) !== null && _a !== void 0 ? _a : "", "");
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
                        .replace((_b = span.textContent) !== null && _b !== void 0 ? _b : "", "")
                        .replace(/\s+/g, " ")
                        .trim();
                }
                title = title.replace(/\s+/g, " ").trim();
            }
            // Parse out the company
            const companyButton = doc.querySelector(`button[aria-label^="${currentCompanyAriaLabelItentifier}"]`);
            let company = "";
            if (companyButton) {
                const fullAriaLabel = companyButton.getAttribute("aria-label");
                const start = currentCompanyAriaLabelItentifier.length;
                const end = fullAriaLabel === null || fullAriaLabel === void 0 ? void 0 : fullAriaLabel.indexOf(".", start);
                company = (_c = fullAriaLabel === null || fullAriaLabel === void 0 ? void 0 : fullAriaLabel.substring(start, end).trim()) !== null && _c !== void 0 ? _c : "";
            }
            resolve({ name, title, company });
        })
            .catch((error) => {
            reject(error);
        });
    });
}
async function parseOutLinkedInSalesNavProfile() {
    const nameParamIdentifier = '[data-anonymize="person-name"]';
    const jobTitleParamIdentifier = '[data-anonymize="job-title"]';
    const currentCompanyParamItentifier = '[data-anonymize="company-name"]';
    const linkedInProfileHrefIdentifier = 'a[href^="https://www.linkedin.com/in/"]';
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
            const linkedInProfileElement = doc.querySelector(linkedInProfileHrefIdentifier);
            let linkedInProfileUrl = "";
            if (linkedInProfileElement) {
                const fullHref = linkedInProfileElement.getAttribute("href");
                linkedInProfileUrl = (fullHref === null || fullHref === void 0 ? void 0 : fullHref.split("?")[0]) + "/"; // Extract the base URL without parameters
            }
            resolve({ name, title, company, email, linkedInProfileUrl });
        })
            .catch((error) => {
            reject(error);
        });
    });
}
async function getData(dataType) {
    var _a;
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
            const meetElement = document.getElementById("personalCRMMeet");
            const meet = meetElement ? meetElement.innerText : "";
            const detailsElement = document.getElementById("personalCRMDetails");
            const details = detailsElement ? detailsElement.innerText : "";
            return { humanReadableDate, dataType, url, meet, details };
        }
        if (url === null || url === void 0 ? void 0 : url.includes("https://www.linkedin.com/in/")) {
            const data = await parseOutLinkedInProfile();
            return Object.assign({ humanReadableDate, dataType, url }, data);
        }
        if (url === null || url === void 0 ? void 0 : url.includes("https://www.linkedin.com/sales/lead/")) {
            const data = await parseOutLinkedInSalesNavProfile();
            if (data.linkedInProfileUrl) {
                url = (_a = data.linkedInProfileUrl) !== null && _a !== void 0 ? _a : url;
            }
            return Object.assign({ humanReadableDate, dataType, url }, data);
        }
        return { humanReadableDate, dataType, url };
    }
    catch (_b) {
        return { humanReadableDate, dataType, url: "" };
    }
    finally {
        setLoading(false);
    }
}
(_a = document
    .getElementById("linkedInDM")) === null || _a === void 0 ? void 0 : _a.addEventListener("click", async function (event) {
    var _a;
    setLoading(true);
    const data = await getData("LinkedIn DM Prospecting");
    (_a = event.target) === null || _a === void 0 ? void 0 : _a.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
});
(_b = document
    .getElementById("linkedInFollowup")) === null || _b === void 0 ? void 0 : _b.addEventListener("click", async function (event) {
    var _a;
    setLoading(true);
    const data = await getData("LinkedIn Follow Up DM Prospecting");
    (_a = event.target) === null || _a === void 0 ? void 0 : _a.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
});
(_c = document
    .getElementById("warmIntro")) === null || _c === void 0 ? void 0 : _c.addEventListener("click", async function (event) {
    var _a;
    setLoading(true);
    const data = await getData("Warm Intro Connector Prospecting");
    (_a = event.target) === null || _a === void 0 ? void 0 : _a.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
});
(_d = document
    .getElementById("emailed")) === null || _d === void 0 ? void 0 : _d.addEventListener("click", async function (event) {
    var _a;
    setLoading(true);
    const data = await getData("Emailed Prospecting");
    (_a = event.target) === null || _a === void 0 ? void 0 : _a.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
});
(_e = document
    .getElementById("followOnLI")) === null || _e === void 0 ? void 0 : _e.addEventListener("click", async function (event) {
    var _a;
    setLoading(true);
    const data = await getData("LinkedIn Follow Prospecting");
    (_a = event.target) === null || _a === void 0 ? void 0 : _a.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
});
(_f = document
    .getElementById("ycCofounder")) === null || _f === void 0 ? void 0 : _f.addEventListener("click", async function (event) {
    var _a;
    const data = await getData("YC Cofounder Match Prospecting");
    (_a = event.target) === null || _a === void 0 ? void 0 : _a.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
});
(_g = document
    .getElementById("cambrianCofounder")) === null || _g === void 0 ? void 0 : _g.addEventListener("click", async function (event) {
    var _a;
    setLoading(true);
    const data = await getData("Cambrian Cofounder Match Prospecting");
    (_a = event.target) === null || _a === void 0 ? void 0 : _a.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
});
(_h = document
    .getElementById("linkedInDMRecruiting")) === null || _h === void 0 ? void 0 : _h.addEventListener("click", async function (event) {
    var _a;
    setLoading(true);
    const data = await getData("LinkedIn DM Recruiting");
    (_a = event.target) === null || _a === void 0 ? void 0 : _a.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
});
(_j = document
    .getElementById("warmIntroRecruiting")) === null || _j === void 0 ? void 0 : _j.addEventListener("click", async function (event) {
    var _a;
    setLoading(true);
    const data = await getData("Warm Intro Connector Recruiting");
    saveToSheets(data);
    (_a = event.target) === null || _a === void 0 ? void 0 : _a.blur(); // Makes button responsive (focus remains during call to saveToSheets)
});
(_k = document
    .getElementById("emailedRecruiting")) === null || _k === void 0 ? void 0 : _k.addEventListener("click", async function (event) {
    var _a;
    setLoading(true);
    const data = await getData("Emailed Recruiting");
    (_a = event.target) === null || _a === void 0 ? void 0 : _a.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
});
(_l = document
    .getElementById("followOnLIRecruiting")) === null || _l === void 0 ? void 0 : _l.addEventListener("click", async function (event) {
    var _a;
    setLoading(true);
    const data = await getData("LinkedIn Follow Recruiting");
    (_a = event.target) === null || _a === void 0 ? void 0 : _a.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
});
(_m = document
    .getElementById("ycCofounderRecruiting")) === null || _m === void 0 ? void 0 : _m.addEventListener("click", async function (event) {
    var _a;
    setLoading(true);
    const data = await getData("YC Cofounder Match Recruiting");
    saveToSheets(data);
    (_a = event.target) === null || _a === void 0 ? void 0 : _a.blur(); // Makes button responsive (focus remains during call to saveToSheets)
});
(_o = document
    .getElementById("cambrianCofounderRecruiting")) === null || _o === void 0 ? void 0 : _o.addEventListener("click", async function (event) {
    var _a;
    setLoading(true);
    const data = await getData("Cambrian Cofounder Match Recruiting");
    (_a = event.target) === null || _a === void 0 ? void 0 : _a.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
});
(_p = document
    .getElementById("saveToPersonalCRM")) === null || _p === void 0 ? void 0 : _p.addEventListener("click", async function (event) {
    var _a;
    setLoading(true);
    const data = await getData("Personal CRM");
    (_a = event.target) === null || _a === void 0 ? void 0 : _a.blur(); // Makes button responsive (focus remains during call to saveToSheets)
    saveToSheets(data);
    const personalCRMMeetElement = document.getElementById("personalCRMMeet");
    if (personalCRMMeetElement) {
        personalCRMMeetElement.innerText = "";
    }
    const personalCRMDetailsElement = document.getElementById("personalCRMDetails");
    if (personalCRMDetailsElement) {
        personalCRMDetailsElement.innerText = "";
    }
});
(_q = document.getElementById("openSheet")) === null || _q === void 0 ? void 0 : _q.addEventListener("click", function () {
    chrome.tabs.create({
        url: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`,
    });
});
