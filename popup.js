// popup.js

document.addEventListener('DOMContentLoaded', function() {
  const extractHexDataButton = document.getElementById('extractHexDataButton');
  const captureMapScreenshotButton = document.getElementById('captureMapScreenshotButton');
  const toggleSecretDoorsButton = document.getElementById('toggleSecretDoorsButton');
  const addGmNotesButton = document.getElementById('addGmNotesButton');
  const statusDiv = document.getElementById('status');

  // Helper function to extract links from HTML content (now in popup.js scope)
  // This function is executed in the popup's context where DOMParser is available.
  function extractLinksFromHtml(htmlContent) {
    const parser = new DOMParser(); // DOMParser is available here
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const links = doc.querySelectorAll('a[href]');
    const locationLinks = new Set(); // Use a Set to avoid duplicate links and ensure uniqueness

    links.forEach(link => {
        const href = link.getAttribute('href');
        // Filter for 'location' links from Hexroll.app
        // They should already be absolute URLs due to previous processing in extractHexDataForGMNotes
        if (href && href.startsWith('https://5e.hexroll.app/sandbox/') && href.includes('/location/')) {
            locationLinks.add(href);
        }
    });
    return Array.from(locationLinks);
  }

  // Event Listener for Hex Data Extraction
  extractHexDataButton.addEventListener('click', function() {
    statusDiv.textContent = 'Extracting Hex Data...';
    // Call the generic extraction and sending function with the specific extraction logic
    extractAndSendToFoundry(extractHexDataAndTitleInjected, "hexData"); // Renamed function reference
  });
const createMerchantButton = document.getElementById('createMerchantButton');

  // Event Listener for Creating a Merchant NPC
  createMerchantButton.addEventListener('click', function() {
    statusDiv.textContent = 'Extracting merchant data...';

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        statusDiv.textContent = 'No active tab found.';
        return;
      }

      const tabId = tabs[0].id;

      // Inject the merchant extraction function into the Hexroll page
      chrome.scripting.executeScript({
        target: {tabId: tabId},
        function: extractMerchantData
      }, (injectionResults) => {
        if (chrome.runtime.lastError) {
          statusDiv.textContent = 'Error extracting merchant data: ' + chrome.runtime.lastError.message;
          console.error("Extraction error:", chrome.runtime.lastError);
          return;
        }

        const result = injectionResults[0].result;
        if (result && result.merchantName) {
          statusDiv.textContent = `Found merchant: ${result.merchantName}. Sending to Foundry VTT...`;
          
          // Send the extracted data to the background script
          chrome.runtime.sendMessage({
            action: "createMerchantInFoundry",
            data: result
          })
          .then(response => {
            if (response.status === "success") {
              statusDiv.textContent = response.message;
            } else {
              statusDiv.textContent = `Error: ${response.message}`;
            }
          })
          .catch(error => {
            statusDiv.textContent = `Communication error: ${error.message}`;
            console.error("Communication error:", error);
          });

        } else {
          statusDiv.textContent = 'Could not find merchant data. Is this a merchant page?';
        }
      });
    });
  });

  /**
   * This function is INJECTED into the Hexroll page to scrape merchant data.
   */
  function extractMerchantData() {
    const contentContainer = document.getElementById('entity-container');
    if (!contentContainer) return null;

    const merchantNameEl = contentContainer.querySelector('h3');
    const merchantName = merchantNameEl ? merchantNameEl.innerText.trim() : null;

    if (!merchantName) return null;

    // The bio is assumed to be the paragraph immediately following the name heading
    const merchantBioEl = merchantNameEl.nextElementSibling;
    const merchantBio = (merchantBioEl && merchantBioEl.tagName === 'P') ? merchantBioEl.innerHTML : '';

    const items = [];
    const itemTable = contentContainer.querySelector('table');
    if (itemTable) {
      const itemRows = itemTable.querySelectorAll('tbody tr');
      itemRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const itemName = cells[0].innerText.trim();
          const itemPrice = cells[1].innerText.trim();
          if (itemName) {
            items.push({ name: itemName, price: itemPrice });
          }
        }
      });
    }

    return { merchantName, merchantBio, items };
  }
  // Event Listener for Map Screenshot
  captureMapScreenshotButton.addEventListener('click', function() {
    statusDiv.textContent = 'Capturing map screenshot...';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        statusDiv.textContent = 'No active tab found.';
        return;
      }

      const tabId = tabs[0].id;

      chrome.scripting.executeScript({
        target: {tabId: tabId},
        function: getHexTitleForScreenshot // Injects function to get title from Hexroll page
      }, (injectionResults) => {
        if (chrome.runtime.lastError) {
          statusDiv.textContent = 'Error getting title for screenshot: ' + chrome.runtime.lastError.message;
          console.error("Error getting title for screenshot:", chrome.runtime.lastError);
          return;
        }

        const hexTitle = injectionResults[0].result;
        
        // Send message to background script to capture and download the screenshot
        chrome.runtime.sendMessage({
          action: "captureMapScreenshot",
          title: hexTitle // Pass the title for the filename
        })
        .then(response => {
          if (response.status === "success") {
            statusDiv.textContent = response.message;
          } else {
            statusDiv.textContent = `Error: ${response.message}`;
          }
        })
        .catch(error => {
          statusDiv.textContent = `Communication error: ${error.message}`;
          console.error("Communication error:", error);
        });
      });
    });
  });

  // Event Listener for Toggling Secret Doors
  toggleSecretDoorsButton.addEventListener('click', function() {
    statusDiv.textContent = 'Toggling secret doors...';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        statusDiv.textContent = 'No active tab found.';
        return;
      }

      const tabId = tabs[0].id;

      // Inject the toggling function into the Hexroll page
      chrome.scripting.executeScript({
        target: {tabId: tabId},
        function: toggleSvgSecretDoors // Injects function to toggle SVG elements
      }, (injectionResults) => {
        if (chrome.runtime.lastError) {
          statusDiv.textContent = 'Error toggling secret doors: ' + chrome.runtime.lastError.message;
          console.error("Error toggling secret doors:", chrome.runtime.lastError);
          return;
        }
        const result = injectionResults[0].result;
        if (result.status === "success") {
          statusDiv.textContent = result.message;
        } else {
          statusDiv.textContent = `Toggle failed: ${result.message}`;
        }
      });
    });
  });

  // Event Listener for Adding to GM Notes (now includes linked location processing)
  addGmNotesButton.addEventListener('click', function() {
    statusDiv.textContent = 'Extracting data for GM Notes and linked locations...';

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        statusDiv.textContent = 'No active tab found.';
        return;
      }

      const hexrollTabId = tabs[0].id; // Get ID of the current Hexroll tab
      const originalHexrollUrl = tabs[0].url; // Store original URL to return to

      let attempts = 0;
      const maxAttempts = 10;
      const delay = 500;

      function tryExtractionForGMNotesAndLinks() {
        // First, extract the current hex data (for GM notes and to find links)
        chrome.scripting.executeScript({
          target: {tabId: hexrollTabId},
          function: extractHexDataForGMNotes // This function is now defined in popup.js
        }, (injectionResults) => {
          if (chrome.runtime.lastError) {
            statusDiv.textContent = 'Error during GM Notes extraction: ' + chrome.runtime.lastError.message;
            console.error("Error during GM Notes extraction:", chrome.runtime.lastError);
            return;
          }

          const result = injectionResults[0].result;
          if (result && result.hexTitle && result.rawHexContentHtml && result.rawHexContentHtml.trim().length > 0) {
            statusDiv.textContent = `Current hex data found. Adding to GM Notes and processing linked locations...`;
            
            // Extract links from the raw content *here* in popup.js, where DOMParser is available
            const locationLinks = extractLinksFromHtml(result.rawHexContentHtml);
            console.log("Extracted linked locations from current hex content:", locationLinks);

            // Send the combined message to background.js
            chrome.runtime.sendMessage({
              action: "addGMNotesAndProcessLinks", // Combined action
              hexrollTabId: hexrollTabId,           // Pass Hexroll tab ID
              originalUrl: originalHexrollUrl,      // Pass original URL
              title: result.hexTitle,               // Current hex title
              content: result.rawHexContentHtml,    // Raw content for GM notes
              locationLinks: locationLinks          // Pass extracted links
            })
            .then(response => {
              if (response.status === "success") {
                statusDiv.textContent = response.message;
              } else {
                statusDiv.textContent = `Error: ${response.message}`;
              }
            })
            .catch(error => {
              statusDiv.textContent = `Communication error: ${error.message}`;
              console.error("Communication error:", error);
            });

          } else {
            attempts++;
            if (attempts < maxAttempts) {
              statusDiv.textContent = `Retrying GM Notes/links extraction (${attempts}/${maxAttempts})...`;
              setTimeout(tryExtractionForGMNotesAndLinks, delay);
            } else {
              statusDiv.textContent = `Could not find current hex data for GM Notes or links after multiple attempts. Please ensure the Hexroll page has fully loaded.`;
            }
          }
        });
      }
      tryExtractionForGMNotesAndLinks(); // Start the first extraction attempt
    });
  });


  /**
   * Generic function to handle HTML extraction and sending to Foundry VTT.
   * Includes retry logic for dynamic content loading.
   * @param {Function} extractionFunction The function to inject into the page to extract data.
   * @param {string} dataType A string indicating the type of data being extracted (e.g., "hexData").
   */
  function extractAndSendToFoundry(extractionFunction, dataType) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        statusDiv.textContent = 'No active tab found.';
        return;
      }

      const tabId = tabs[0].id;
      let attempts = 0;
      const maxAttempts = 10;
      const delay = 500; // milliseconds

      function tryExtraction() {
        chrome.scripting.executeScript({
          target: {tabId: tabId},
          function: extractionFunction // Execute the provided extraction function
        }, (injectionResults) => {
          if (chrome.runtime.lastError) {
            statusDiv.textContent = 'Error during content extraction: ' + chrome.runtime.lastError.message;
            console.error("Error during content extraction:", chrome.runtime.lastError);
            return;
          }

          const result = injectionResults[0].result;
          // Check if both title and content are present and content is not just whitespace
          if (result && result.hexTitle && result.hexContentHtml && result.hexContentHtml.trim().length > 0) {
            statusDiv.textContent = `Hex data found. Sending to Foundry VTT...`;
            
            // Send the extracted data to the background script for further processing
            chrome.runtime.sendMessage({
              action: "sendDataToFoundry", // Generic action for data transfer
              dataType: dataType,         // Specific type of data (e.g., "hexData")
              title: result.hexTitle,     // Extracted title
              content: result.hexContentHtml // Cleaned HTML content
            })
            .then(response => {
              if (response.status === "success") {
                statusDiv.textContent = response.message;
              } else {
                statusDiv.textContent = `Error: ${response.message}`;
              }
            })
            .catch(error => {
              statusDiv.textContent = `Communication error: ${error.message}`;
              console.error("Communication error:", error);
            });

          } else {
            // If data is not found or is empty, retry if max attempts not reached
            attempts++;
            if (attempts < maxAttempts) {
              statusDiv.textContent = `Retrying (${attempts}/${maxAttempts})...`;
              setTimeout(tryExtraction, delay);
            } else {
              // If max attempts reached, show a failure message
              statusDiv.textContent = `Could not find hex data after multiple attempts. Please ensure the Hexroll page has fully loaded.`;
            }
          }
        });
      }
      tryExtraction(); // Start the first extraction attempt
    });
  }

  // --- Functions to be INJECTED into the Hexroll.app page ---
  // These functions must be defined in the global scope of the script
  // that calls chrome.scripting.executeScript, or provided as standalone functions.
  // We're moving extractHexDataAndTitle here from popup.js and renaming
  // the reference in popup.js to extractHexDataAndTitleInjected for clarity.
  function extractHexDataAndTitleInjected() { // Renamed for clarity in popup.js
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

  /**
   * Extracts the hex data without the "secret" section wrapping, suitable for GM Notes.
   * This function runs in the context of the Hexroll web page.
   * It also converts relative Hexroll links to absolute URLs.
   * @returns {Object} An object containing { hexTitle: string, rawHexContentHtml: string }.
   */
  function extractHexDataForGMNotes() {
    const hexContentContainer = document.getElementById('entity-container');
    const titleSpan = document.getElementById('editable-title');
    
    const hexTitle = titleSpan ? titleSpan.innerText.trim() : "Untitled Hex Entry";
    let rawHexContentHtml = '';

    if (hexContentContainer) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = hexContentContainer.innerHTML;

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
          editorPlaceholder.remove();
      }

      tempDiv.querySelectorAll('[bis_skin_checked]').forEach(el => {
          el.removeAttribute('bis_skin_checked');
      });

      tempDiv.querySelectorAll('p').forEach(p => {
          if (p.textContent.trim() === '' && p.children.length === 0) {
              if (p.innerHTML.trim() === '' || p.innerHTML.trim() === '&nbsp;') {
                  p.remove();
              }
          }
      });

      // Identify the active content div (entity1 or entity2)
      let activeContentDiv = null;
      if (entity1Div && !entity1Div.classList.contains('hidden') && entity1Div.innerHTML.trim().length > 0) {
          activeContentDiv = entity1Div;
      } else if (entity2Div && !entity2Div.classList.contains('hidden') && entity2Div.innerHTML.trim().length > 0) {
          activeContentDiv = entity2Div;
      }

      if (activeContentDiv) {
          // For GM Notes, just return the innerHTML of the active content div directly, no secret section
          rawHexContentHtml = activeContentDiv.innerHTML;

          // Convert relative links to absolute links within the extracted HTML
          const tempAnchorDiv = document.createElement('div');
          tempAnchorDiv.innerHTML = rawHexContentHtml;

          const links = tempAnchorDiv.querySelectorAll('a[href]');
          links.forEach(link => {
              const href = link.getAttribute('href');
              // Check if the href starts with "sandbox/" or "/sandbox/" (relative path we want to fix)
              if (href && (href.startsWith('sandbox/') || href.startsWith('/sandbox/'))) {
                  const cleanHref = href.startsWith('/') ? href.substring(1) : href;
                  link.setAttribute('href', `https://5e.hexroll.app/${cleanHref}`);
              }
          });
          rawHexContentHtml = tempAnchorDiv.innerHTML;
      }
    }
    return { hexTitle, rawHexContentHtml };
  }

  /**
   * Extracts the hex title from the Hexroll page for use in screenshot filename.
   * This function runs in the context of the Hexroll web page.
   * @returns {string} The trimmed innerText of the editable-title span, or a default string.
   */
  function getHexTitleForScreenshot() {
    const titleSpan = document.getElementById('editable-title');
    return titleSpan ? titleSpan.innerText.trim() : "Untitled Hex";
  }

  /**
   * Toggles the visibility of specific SVG text elements representing secret doors.
   * This function is injected and runs in the context of the Hexroll web page.
   * It relies on a CSS class `ext-hidden` to toggle visibility.
   * @returns {Object} A status object indicating success or failure.
   */
  function toggleSvgSecretDoors() {
    try {
      const secretDoors = document.querySelectorAll('text.dcoords');
      let foundAny = false;
      let allHidden = true;

      if (secretDoors.length === 0) {
        return { status: "success", message: "No secret doors (SVG 'S' text) found on the map." };
      }

      for (const door of secretDoors) {
        if (door.textContent.trim() === 'S') {
          foundAny = true;
          if (!door.classList.contains('ext-hidden')) {
            allHidden = false;
            break; 
          }
        }
      }

      let newStateMessage = "";
      if (foundAny) {
        for (const door of secretDoors) {
          if (door.textContent.trim() === 'S') {
            if (allHidden) {
              door.classList.remove('ext-hidden'); 
              door.style.display = '';
            } else {
              door.classList.add('ext-hidden'); 
              door.style.display = 'none';
            }
          }
        }
        newStateMessage = allHidden ? "Secret doors are now VISIBLE." : "Secret doors are now HIDDEN.";
      } else {
        newStateMessage = "No secret doors (SVG 'S' text) found on the map to toggle.";
      }
      
      if (!document.head.querySelector('#ext-secret-door-style')) {
        const style = document.createElement('style');
        style.id = 'ext-secret-door-style';
        style.textContent = '.ext-hidden { visibility: hidden !important; opacity: 0 !important; }';
        document.head.appendChild(style);
      }

      return { status: "success", message: `Toggling secret doors: ${newStateMessage}` };

    } catch (error) {
      console.error("Error in toggleSvgSecretDoors:", error);
      return { status: "error", message: `Error during toggle: ${error.message}` };
    }
  };
});
