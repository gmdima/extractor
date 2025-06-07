// background.js

// Helper function to wait for a specific tab URL to fully load
// This function is crucial for sequential navigation and extraction
async function pageLoadPromise(tabId, url) {
  return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener); // Clean up listener on timeout
          reject(new Error(`Page load timed out for URL: ${url}`));
      }, 20000); // Increased timeout to 20 seconds for potentially slow pages

      const listener = (updatedTabId, changeInfo, tab) => {
          // Ensure it's the correct tab, fully loaded, and the URL matches the target
          if (updatedTabId === tabId && changeInfo.status === 'complete' && tab.url === url) {
              clearTimeout(timeout);
              chrome.tabs.onUpdated.removeListener(listener); // Remove listener once resolved
              resolve(tab);
          }
      };
      chrome.tabs.onUpdated.addListener(listener);
      console.log(`Navigating tab ${tabId} to: ${url}`);
      // Update the tab's URL. This will trigger the onUpdated listener.
      chrome.tabs.update(tabId, { url: url }).catch(reject);
  });
}

// Function that extracts the hex data and title, to be injected into Hexroll.app
// This function needs to be standalone and runnable in the target page's context.
function extractHexDataAndTitle() {
    // Get the main container for hex content
    const hexContentContainer = document.getElementById('entity-container');
    // Get the element containing the hex title
    const titleSpan = document.getElementById('editable-title');
    
    // Extract the hex title, default if not found
    const hexTitle = titleSpan ? titleSpan.innerText.trim() : "Untitled Hex Entry";
    
    let hexContentHtml = ''; // Initialize content as empty string

    if (hexContentContainer) {
      // Create a temporary div to manipulate the HTML content without affecting the live DOM
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = hexContentContainer.innerHTML; // Get the raw HTML content

      // --- Cleanup operations ---
      // Remove inline styles and classes that might hide or misposition elements
      const entity1Div = tempDiv.querySelector('#entity1');
      const entity2Div = tempDiv.querySelector('#entity2');
      const editorPlaceholder = tempDiv.querySelector('#entity-editor-placeholder');

      if (entity1Div) {
        entity1Div.removeAttribute('style');
        entity1Div.classList.remove('hidden', 'view_visible');
      }
      if (entity2Div) {
        entity2Div.removeAttribute('style');
        entity2Div.classList.remove('hidden', 'view_visible');
      }
      if (editorPlaceholder) {
          editorPlaceholder.remove(); // Remove the editor placeholder entirely
      }

      // Remove 'bis_skin_checked' attributes, which are extension-specific and not relevant
      tempDiv.querySelectorAll('[bis_skin_checked]').forEach(el => {
          el.removeAttribute('bis_skin_checked');
      });

      // Remove genuinely empty paragraph tags (e.g., <p></p> or <p>&nbsp;</p>)
      tempDiv.querySelectorAll('p').forEach(p => {
          if (p.textContent.trim() === '' && p.children.length === 0) {
              if (p.innerHTML.trim() === '' || p.innerHTML.trim() === '&nbsp;') {
                  p.remove();
              }
          }
      });

      // --- REVISED LOGIC: Identify the active content div and then separate first paragraph/heading ---

      let activeContentDiv = null;

      // Find the div that is currently visible and contains content
      // Prioritize entity1 if it's visible and has content
      if (entity1Div && !entity1Div.classList.contains('hidden') && entity1Div.innerHTML.trim().length > 0) {
          activeContentDiv = entity1Div;
      } 
      // Otherwise, check entity2 if it's visible and has content
      else if (entity2Div && !entity2Div.classList.contains('hidden') && entity2Div.innerHTML.trim().length > 0) {
          activeContentDiv = entity2Div;
      }

      let firstParagraphHtml = '';
      let secretContentHtml = '';

      if (activeContentDiv) {
          const childrenOfActiveDiv = Array.from(activeContentDiv.children); // Get only element children of the active div

          if (childrenOfActiveDiv.length > 0) {
              // Find the first *meaningful* paragraph or heading.
              // A "meaningful" paragraph/heading is one that is not empty after trimming its text content.
              let foundFirstMeaningfulParagraph = false;
              
              for (const child of childrenOfActiveDiv) {
                  if (child.nodeType === Node.ELEMENT_NODE) { // Ensure it's an element
                      if (!foundFirstMeaningfulParagraph && 
                          (child.tagName === 'P' || child.tagName.startsWith('H')) && 
                          child.textContent.trim().length > 0) {
                          
                          // This is the first non-empty P or H element, capture it for visible content
                          firstParagraphHtml += child.outerHTML;
                          foundFirstMeaningfulParagraph = true;
                      } else if (foundFirstMeaningfulParagraph) {
                          // All subsequent elements after the first meaningful one go into the secret section
                          secretContentHtml += child.outerHTML;
                      } else {
                          // If we haven't found the first meaningful P/H yet,
                          // and this is another element (like an empty <p> or <div>)
                          // we still include it in the visible part before the actual content starts.
                          firstParagraphHtml += child.outerHTML;
                      }
                  }
              }
          } else {
              // If activeContentDiv itself has no children (e.g., just direct text)
              if (activeContentDiv.textContent.trim().length > 0) {
                  // Wrap its direct text content in a paragraph for the visible part
                  firstParagraphHtml = `<p>${activeContentDiv.textContent.trim()}</p>`;
                  secretContentHtml = ''; // No secret content in this case
              }
          }
      }

      // Generate a random ID for the Foundry VTT secret section
      const randomId = Math.random().toString(36).substring(2, 12); 

      // Assemble the final HTML content
      if (secretContentHtml.trim().length > 0) {
          // If there's content for the secret section, enclose it
          hexContentHtml = `${firstParagraphHtml}<section class="secret" id="secret-${randomId}">${secretContentHtml}</section>`;
      } else {
          // If no content for secret, just use the first paragraph (or whatever was captured as visible)
          hexContentHtml = firstParagraphHtml;
      }
    }

    return { hexTitle, hexContentHtml };
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
// Handle messages for sending hex data to Foundry Journal Entry (standard case)
if (message.action === "sendDataToFoundry") {
  const { dataType, title, content } = message;

  chrome.tabs.query({ url: "https://theland.uber.space/game*" }, async (tabs) => {
    if (tabs.length === 0) {
      sendResponse({ status: "error", message: "Foundry VTT tab not found. Please open https://theland.uber.space/game in a Chrome tab." });
      return;
    }
    const foundryTabId = tabs[0].id;

    try {
      console.log(`Attempting to inject createFoundryJournalEntryBasedOnType for ${title} (${dataType})...`);
      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: foundryTabId },
        function: createFoundryJournalEntryBasedOnType,
        args: [dataType, title, content],
        world: 'MAIN'
      });

      if (injectionResults && injectionResults[0] && injectionResults[0].result) {
        const result = injectionResults[0].result;
        if (result.status === "success") {
          sendResponse({ status: "success", message: result.message });
        } else {
          sendResponse({ status: "error", message: result.message });
        }
      } else {
        sendResponse({ status: "error", message: "Unknown error during Foundry VTT script injection or execution for main hex data." });
      }

    } catch (error) {
      console.error("Error during Foundry VTT script injection for main hex data:", error);
      sendResponse({
        status: "error",
        message: `Failed to interact with Foundry VTT tab for main hex data: ${error.message}. Please ensure Foundry VTT is open and loaded in a tab.`
      });
    }
  });
  return true; // Keep message channel open for async response
}

// Handle messages for capturing map screenshot
if (message.action === "captureMapScreenshot") {
  const hexTitle = message.title;
  
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs.length === 0) {
          sendResponse({ status: "error", message: "No active tab found to capture." });
          return;
      }

      try {
          console.log(`Capturing screenshot for: ${hexTitle}`);
          const dataUrl = await chrome.tabs.captureVisibleTab(tabs[0].windowId, { format: 'png', quality: 100 });

          const sanitizedTitle = hexTitle.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase();
          const filename = `Hexroll_Map_${sanitizedTitle}_${Date.now()}.png`;

          chrome.downloads.download({
              url: dataUrl,
              filename: filename,
              saveAs: false // Set to true if you want the "Save As" dialog
          }, (downloadId) => {
              if (chrome.runtime.lastError) {
                  console.error("Download error:", chrome.runtime.lastError.message);
                  sendResponse({ status: "error", message: `Download failed: ${chrome.runtime.lastError.message}` });
              } else if (downloadId) {
                  console.log(`Screenshot downloaded: ${filename}`);
                  sendResponse({ status: "success", message: `Map screenshot "${filename}" downloaded!` });
              } else {
                  console.error("Download failed (unknown reason).");
                  sendResponse({ status: "error", message: "Download failed (unknown reason)." });
              }
          });

      } catch (error) {
          console.error("Error capturing tab:", error);
          sendResponse({ status: "error", message: `Failed to capture screenshot: ${error.message}` });
      }
  });
  return true; // Keep message channel open for async response
}

// Handle combined action for adding GM Notes and processing linked locations
if (message.action === "addGMNotesAndProcessLinks") {
  const { hexrollTabId, originalUrl, title, content, locationLinks } = message; 
  let processedLinksCount = 0;
  let failedLinksCount = 0;
  // Store a map of original Hexroll URL to Foundry UUID
  const uuidMap = {}; 

  console.log("Received addGMNotesAndProcessLinks action. Processing...");

  // Find Foundry VTT tab first, as it's needed for both GM notes and journal page creation
  chrome.tabs.query({ url: "https://theland.uber.space/game*" }, async (tabs) => {
    if (tabs.length === 0) {
      sendResponse({ status: "error", message: "Foundry VTT tab not found. Please open https://theland.uber.space/game in a Chrome tab." });
      return;
    }
    const foundryTabId = tabs[0].id;
    let initialGMNotesContent = content; // Store the original content for later modification

    // --- Part 1: Add GM Notes to selected tile (initial) ---
    try {
      console.log(`Injecting addGMNotesToFoundryTile for current hex: ${title}`);
      const gmNotesInjectionResults = await chrome.scripting.executeScript({
        target: { tabId: foundryTabId },
        function: addGMNotesToFoundryTile, // Injects function to add GM notes
        args: [title, initialGMNotesContent], // Pass hex title and raw content
        world: 'MAIN'
      });

      if (gmNotesInjectionResults && gmNotesInjectionResults[0] && gmNotesInjectionResults[0].result.status !== "success") {
          console.warn("Failed to add GM notes to tile initially:", gmNotesInjectionResults[0].result.result.message);
          // Don't fail the entire process if GM notes failed, just log.
      } else {
          console.log("GM Notes successfully added to selected tile for current hex.");
      }
    } catch (error) {
      console.error("Error adding GM Notes to tile during combined action:", error);
      // Don't fail the entire process if GM notes failed, just log.
    }

    // --- Part 2: Process Linked Locations ---
    console.log("Detected linked locations:", locationLinks);

    if (locationLinks.length === 0) {
        sendResponse({ status: "success", message: `GM Notes added. No linked locations found to process.` });
        return;
    }

    // Function to process each link sequentially
    const processLink = async (index) => {
        if (index >= locationLinks.length) {
            // All links processed, now update the GM notes on the tile with UUIDs
            console.log("All linked locations processed. Updating GM Notes with UUIDs.");
            
            // Generate updated GM Notes content
            let updatedGMNotesContent = initialGMNotesContent;
            for (const hexrollUrl in uuidMap) {
                const uuid = uuidMap[hexrollUrl];
                // Regex to find the <a> tag with the specific href and then insert the UUID link
                // This regex targets <a> tags whose href starts with the hexrollUrl
                // It captures the content inside the <a> tag.
                const regex = new RegExp(`(<a\\s+[^>]*href=["']${escapeRegExp(hexrollUrl)}["'][^>]*>\\s*<strong>)(.*?)(</strong>\\s*<\\/a>)`, 'gi');
                
                updatedGMNotesContent = updatedGMNotesContent.replace(regex, (match, p1, p2, p3) => {
                    // p1 is the opening tag up to <strong>
                    // p2 is the text inside <strong> (e.g., "Tavern")
                    // p3 is the closing </strong></a>
                    return `${p1}${p2}${p3} @UUID[${uuid}]{${p2.trim()}}`;
                });
            }

            try {
                console.log(`Injecting updateGMNotesOnFoundryTile for current hex: ${title}`);
                const updateGMNotesResults = await chrome.scripting.executeScript({
                  target: { tabId: foundryTabId },
                  function: updateGMNotesOnFoundryTile, // New function for updating GM notes
                  args: [title, updatedGMNotesContent], // Pass hex title and updated content
                  world: 'MAIN'
                });

                if (updateGMNotesResults && updateGMNotesResults[0] && updateGMNotesResults[0].result.status !== "success") {
                    console.error("Failed to update GM notes with UUIDs:", updateGMNotesResults[0].result.message);
                    // This error doesn't stop the process, but it's important to log.
                } else {
                    console.log("GM Notes successfully updated with UUIDs.");
                }
            } catch (error) {
                console.error("Error updating GM Notes with UUIDs:", error);
            }

            // Navigate Hexroll tab back to original URL
            console.log("Navigating Hexroll tab back to original URL.");
            try {
                await new Promise(resolve => setTimeout(resolve, 500)); // Small delay before navigating back
                await pageLoadPromise(hexrollTabId, originalUrl); // Use pageLoadPromise for return navigation
                console.log("Navigated Hexroll tab back to original URL successfully.");
            } catch (err) {
                console.error(`Error navigating Hexroll tab back to ${originalUrl}:`, err);
            }
            
            sendResponse({
                status: "success",
                message: `GM Notes updated. Processed ${processedLinksCount} linked locations (${failedLinksCount} failed). Returned to original Hexroll page.`
            });
            return;
        }

        const currentLink = locationLinks[index];
        let currentLinkTitle = `Linked Location ${index + 1}`; // Default title for status
        console.log(`--- Processing linked location ${index + 1}/${locationLinks.length}: ${currentLink} ---`);
        
        try {
            // Navigate Hexroll tab to the new location and wait for it to load
            await pageLoadPromise(hexrollTabId, currentLink);
            console.log(`Successfully navigated to linked location: ${currentLink}`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Additional wait for page to render fully

            // Extract data from the newly loaded Hexroll page
            console.log(`Extracting data from current linked page (${currentLink})...`);
            const extractionResult = await chrome.scripting.executeScript({
                target: { tabId: hexrollTabId },
                function: extractHexDataAndTitle, // This function is now defined in background.js
                world: 'MAIN' // This function runs in the page's context
            });

            const extractedData = extractionResult[0].result;
            if (extractedData && extractedData.hexTitle && extractedData.hexContentHtml && extractedData.hexContentHtml.trim().length > 0) {
                currentLinkTitle = extractedData.hexTitle;
                console.log(`Extracted data for linked location: ${currentLinkTitle}`);
                // Send extracted data to Foundry VTT to create a new Journal Entry page
                console.log(`Sending extracted data for ${currentLinkTitle} to Foundry VTT...`);
                const foundryResult = await chrome.scripting.executeScript({
                    target: { tabId: foundryTabId },
                    function: createFoundryJournalEntryBasedOnType,
                    args: ["hexData", extractedData.hexTitle, extractedData.hexContentHtml],
                    world: 'MAIN'
                });

                if (foundryResult && foundryResult[0] && foundryResult[0].result.status === "success") {
                    processedLinksCount++;
                    const createdPageUUID = foundryResult[0].result.uuid; // Get the UUID
                    uuidMap[currentLink] = createdPageUUID; // Store the mapping
                    console.log(`Successfully created journal for: ${currentLinkTitle} with UUID: ${createdPageUUID}`);
                } else {
                    failedLinksCount++;
                    console.error(`Failed to create journal for ${currentLinkTitle} in Foundry:`, foundryResult[0].result.message);
                }
            } else {
                failedLinksCount++;
                console.error(`Could not extract data from linked location (empty/null): ${currentLink}`);
            }

        } catch (error) {
            failedLinksCount++;
            console.error(`Error processing linked location ${currentLink}:`, error);
        }

        await new Promise(resolve => setTimeout(resolve, 500)); // Delay between processing links
        processLink(index + 1); // Process next link
    };

    // Start processing from the first link
    processLink(0);
  });
  return true; // Keep message channel open for async response
}
});

// Helper function to escape special characters for use in a RegExp
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the matched substring
}

// This function will be injected and executed in the context of the Foundry VTT web page (MAIN world)
async function createFoundryJournalEntryBasedOnType(dataType, title, content) {
  console.log(`Foundry VTT interaction function loaded in main world for ${dataType}.`);

  const waitForFoundryReady = () => new Promise(resolve => {
      if (typeof game !== 'undefined' && game.ready) {
          resolve();
      } else {
          Hooks.once("ready", resolve);
      }
  });

  try {
      await waitForFoundryReady();
      console.log("Foundry VTT 'game' object is ready for action.");

      let worldJournal = game.journal.find(j => j.name === "World" && j.parent === null);

      if (!worldJournal) {
          console.log("Creating new 'World' Journal Entry...");
          worldJournal = await JournalEntry.create({
              name: "World",
              content: "",
              folder: null
          });
          if (!worldJournal) {
              throw new Error("Failed to create 'World' Journal Entry.");
          }
          ui.notifications.info("Created a new Journal Entry: 'World'", { permanent: false, duration: 5000 });
      }

      let newPageData = {
        name: title
      };

      if (dataType === "hexData") {
        newPageData.text = {
          content: content,
          format: 1 // HTML format
        };
      } else {
        newPageData.text = {
          content: `<p>Unsupported data type for journal entry: ${dataType}</p>`,
          format: 1
        };
        ui.notifications.warn(`Attempted to create journal entry for unsupported data type: ${dataType}`);
      }

      const newPage = await JournalEntryPage.create(newPageData, { parent: worldJournal });

      if (newPage) {
          ui.notifications.info(`${title} added to Journal 'World'.`, { permanent: false, duration: 7000 });
          console.log("JournalEntryPage created:", newPage);
          // Return the UUID of the newly created page
          return { status: "success", message: `Journal entry "${title}" created successfully!`, uuid: `JournalEntry.${worldJournal.id}.JournalEntryPage.${newPage.id}` };
      } else {
          throw new Error("Failed to create new JournalEntryPage.");
      }

  } catch (error) {
      console.error("Error creating Foundry VTT journal entry:", error);
      ui.notifications.error(`Failed to add data to Foundry VTT: ${error.message}`, { permanent: false, duration: 10000 });
      return { status: "error", message: `Failed to add Foundry VTT journal entry: ${error.message}` };
  }
}

// This function will be injected and executed in the context of the Foundry VTT web page (MAIN world)
async function addGMNotesToFoundryTile(hexTitle, hexContent) {
  console.log(`Foundry VTT function to add GM Notes to selected tile loaded.`);

  const waitForFoundryReady = () => new Promise(resolve => {
      if (typeof game !== 'undefined' && game.ready) {
          resolve();
      } else {
          Hooks.once("ready", resolve);
      }
  });

  try {
      await waitForFoundryReady();
      console.log("Foundry VTT 'game' object is ready for GM Notes update.");

      if (!game.canvas.tiles || game.canvas.tiles.controlled.size === 0) {
          ui.notifications.warn("No tile is selected/controlled on the canvas. Please select a tile first.", { permanent: false, duration: 7000 });
          return { status: "error", message: "No tile selected on Foundry VTT canvas." };
      }

      const selectedTile = Array.from(game.canvas.tiles.controlled)[0];

      if (selectedTile && selectedTile.document) {
          await selectedTile.document.setFlag("gm-notes", "notes", hexContent);

          ui.notifications.info(`GM Notes for "${hexTitle}" added to selected tile!`, { permanent: false, duration: 7000 });
          console.log("GM Notes added to tile:", selectedTile.document.id);
          return { status: "success", message: `GM Notes for "${hexTitle}" successfully added to selected tile.` };
      } else {
          ui.notifications.error("Could not find document for selected tile.", { permanent: false, duration: 7000 });
          return { status: "error", message: "Could not find document for selected tile." };
      }

  } catch (error) {
      console.error("Error adding GM Notes to tile:", error);
      ui.notifications.error(`Failed to add GM Notes: ${error.message}`, { permanent: false, duration: 10000 });
      return { status: "error", message: `Failed to add GM Notes: ${error.message}` };
  }
}

// This function will be injected and executed in the context of the Foundry VTT web page (MAIN world)
// Used specifically for updating existing GM Notes content with UUIDs.
async function updateGMNotesOnFoundryTile(hexTitle, updatedContent) {
  console.log(`Foundry VTT function to update GM Notes on selected tile loaded.`);

  const waitForFoundryReady = () => new Promise(resolve => {
      if (typeof game !== 'undefined' && game.ready) {
          resolve();
      } else {
          Hooks.once("ready", resolve);
      }
  });

  try {
      await waitForFoundryReady();
      console.log("Foundry VTT 'game' object is ready for GM Notes update.");

      if (!game.canvas.tiles || game.canvas.tiles.controlled.size === 0) {
          // This case should ideally not happen if addGMNotesToFoundryTile was called first
          // but handle it defensively.
          ui.notifications.warn("No tile is selected/controlled on the canvas for GM Notes update. Please select a tile first.", { permanent: false, duration: 7000 });
          return { status: "error", message: "No tile selected on Foundry VTT canvas for update." };
      }

      const selectedTile = Array.from(game.canvas.tiles.controlled)[0];

      if (selectedTile && selectedTile.document) {
          await selectedTile.document.setFlag("gm-notes", "notes", updatedContent);

          ui.notifications.info(`GM Notes for "${hexTitle}" updated with linked locations!`, { permanent: false, duration: 7000 });
          console.log("GM Notes updated on tile:", selectedTile.document.id);
          return { status: "success", message: `GM Notes for "${hexTitle}" successfully updated on selected tile.` };
      } else {
          ui.notifications.error("Could not find document for selected tile during GM Notes update.", { permanent: false, duration: 7000 });
          return { status: "error", message: "Could not find document for selected tile during update." };
      }

  } catch (error) {
      console.error("Error updating GM Notes on tile:", error);
      ui.notifications.error(`Failed to update GM Notes: ${error.message}`, { permanent: false, duration: 10000 });
      return { status: "error", message: `Failed to update GM Notes: ${error.message}` };
  }
}