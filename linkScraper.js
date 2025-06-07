// linkScraper.js - This script runs on Hexroll.app pages and handles background fetching.

// Helper function to extract the hex title and content from fetched HTML
// This is similar to extractHexDataAndTitle but operates on a provided HTML string.
function extractDataFromHtmlString(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const hexContentContainer = doc.getElementById('entity-container');
    const titleSpan = doc.getElementById('editable-title');
    
    const hexTitle = titleSpan ? titleSpan.innerText.trim() : "Untitled Hex Entry";
    let hexContentHtml = '';

    if (hexContentContainer) {
        const tempDiv = document.createElement('div'); // Using document here is fine as it's within content script
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

        let activeContentDiv = null;
        if (entity1Div && !entity1Div.classList.contains('hidden') && entity1Div.innerHTML.trim().length > 0) {
            activeContentDiv = entity1Div;
        } else if (entity2Div && !entity2Div.classList.contains('hidden') && entity2Div.innerHTML.trim().length > 0) {
            activeContentDiv = entity2Div;
        }

        if (activeContentDiv) {
            let firstParagraphHtml = '';
            let secretContentHtml = '';
            const childrenOfActiveDiv = Array.from(activeContentDiv.children);

            if (childrenOfActiveDiv.length > 0) {
                let foundFirstMeaningfulParagraph = false;
                for (const child of childrenOfActiveDiv) {
                    if (child.nodeType === Node.ELEMENT_NODE) {
                        if (!foundFirstMeaningfulParagraph && 
                            (child.tagName === 'P' || child.tagName.startsWith('H')) && 
                            child.textContent.trim().length > 0) {
                            firstParagraphHtml += child.outerHTML;
                            foundFirstMeaningfulParagraph = true;
                        } else if (foundFirstMeaningfulParagraph) {
                            secretContentHtml += child.outerHTML;
                        } else {
                            firstParagraphHtml += child.outerHTML;
                        }
                    }
                }
            } else {
                if (activeContentDiv.textContent.trim().length > 0) {
                    firstParagraphHtml = `<p>${activeContentDiv.textContent.trim()}</p>`;
                    secretContentHtml = '';
                }
            }

            const randomId = Math.random().toString(36).substring(2, 12); 
            if (secretContentHtml.trim().length > 0) {
                hexContentHtml = `${firstParagraphHtml}<section class="secret" id="secret-${randomId}">${secretContentHtml}</section>`;
            } else {
                hexContentHtml = firstParagraphHtml;
            }
        }
    }
    return { hexTitle, hexContentHtml };
}


chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === "scrapeLinkedLocations") {
        const { locationLinks } = message;
        const scrapedData = [];
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < locationLinks.length; i++) {
            const link = locationLinks[i];
            console.log(`[linkScraper.js] Fetching linked location ${i + 1}/${locationLinks.length}: ${link}`);
            try {
                const response = await fetch(link);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const html = await response.text();
                const extracted = extractDataFromHtmlString(html);

                if (extracted && extracted.hexTitle && extracted.hexContentHtml && extracted.hexContentHtml.trim().length > 0) {
                    scrapedData.push({
                        originalUrl: link,
                        title: extracted.hexTitle,
                        content: extracted.hexContentHtml
                    });
                    successCount++;
                    // Send progress update back to popup or background
                    chrome.runtime.sendMessage({
                        action: "linkedLocationProgress",
                        currentLink: link,
                        title: extracted.hexTitle,
                        index: i + 1,
                        total: locationLinks.length,
                        status: "success",
                        message: `Scraped: ${extracted.hexTitle}`
                    }).catch(e => console.error("Error sending progress message:", e));
                } else {
                    failCount++;
                    console.error(`[linkScraper.js] Could not extract data from fetched HTML for: ${link}`);
                    chrome.runtime.sendMessage({
                        action: "linkedLocationProgress",
                        currentLink: link,
                        index: i + 1,
                        total: locationLinks.length,
                        status: "error",
                        message: `Failed to extract data from: ${link}`
                    }).catch(e => console.error("Error sending progress message:", e));
                }
            } catch (error) {
                failCount++;
                console.error(`[linkScraper.js] Error fetching or processing ${link}:`, error);
                chrome.runtime.sendMessage({
                    action: "linkedLocationProgress",
                    currentLink: link,
                    index: i + 1,
                    total: locationLinks.length,
                    status: "error",
                    message: `Fetch failed for: ${link} (${error.message})`
                }).catch(e => console.error("Error sending progress message:", e));
            }
            // Small delay between fetches to be polite to the server
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Send all scraped data back to the background script once done
        chrome.runtime.sendMessage({
            action: "allLinkedLocationsScraped",
            scrapedData: scrapedData,
            processedCount: successCount,
            failedCount: failCount
        }).catch(e => console.error("Error sending final scraped data message:", e));

        sendResponse({ status: "success", message: "Scraping initiated." });
        return true; // Keep message channel open for async response
    }
});