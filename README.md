# Hexroll Integration

This browser extension enhances your tabletop role-playing game sessions by integrating [Hexroll.app](https://5e.hexroll.app/) with Foundry Virtual Tabletop (Foundry VTT). It allows you to seamlessly extract detailed hex information, location descriptions, merchant data, and map visuals from Hexroll and transfer them into your Foundry VTT game world.

## Core Features

The Hexroll Integration extension offers several powerful features to streamline your game preparation:

*   **Hex Data to Foundry Journal**:
    *   Extracts detailed content from the current Hexroll.app hex or location page.
    *   Intelligently separates content into a main description and a collapsible "secret" section within a Foundry VTT journal page. This is perfect for GM-only information.
    *   Creates or updates entries within a "World" journal in Foundry VTT.

*   **GM Notes Integration**:
    *   Adds the full HTML content of the current Hexroll.app hex or location page directly to the GM Notes field of a selected tile on your Foundry VTT canvas.

*   **Linked Location Processing**:
    *   When viewing a Hexroll page that links to other Hexroll locations (e.g., a regional map linking to towns, dungeons, or points of interest):
        1.  The main page's content is added to the GM Notes of a selected Foundry tile.
        2.  The extension then automatically navigates to each linked Hexroll page.
        3.  Content from each linked page is extracted and used to create a new, separate journal entry page in your "World" journal in Foundry.
        4.  The GM Notes on the original tile are then updated with direct `@UUID` links to these newly created journal pages, creating an interconnected web of information within Foundry VTT.

*   **Merchant NPC Creation**:
    *   Parses merchant details (name, biography, items for sale with prices) from a dedicated Hexroll merchant page.
    *   Creates a new NPC actor in Foundry VTT, populating its biography and attempting to add listed items to its inventory (searching SRD compendiums first, then creating new items if not found).

*   **Map Screenshotting (Dungeon/Town Scene Create)**:
    *   Captures a screenshot of the visible area of the current Hexroll.app map (e.g., dungeon map, town map).
    *   Downloads the image as a PNG file, named with the hex/location title. This image can then be easily used to create a new scene in Foundry VTT.

*   **Secret Door Toggle**:
    *   On Hexroll.app map pages, this feature allows GMs to toggle the visibility of secret door indicators (typically marked as 'S' on SVG maps). This is useful for GMs who might be screen-sharing with players, allowing them to quickly hide or reveal secret doors without altering the underlying map data.

## How it Works

This extension operates as a standard browser extension, primarily running in your browser's background.
Key mechanisms include:

*   **Popup Interface**: A simple popup (accessed by clicking the extension icon) provides buttons to trigger various actions.
*   **Script Injection**: To read data from Hexroll.app and to interact with Foundry VTT, the extension injects small pieces of JavaScript code directly into the web pages of these services. These scripts run in the context of the page, allowing them to access the necessary information or perform actions.
*   **Background Script**: A central background script coordinates these operations, handles communication between the popup and injected scripts, and manages tasks like downloads or multi-step processes (like linked location processing).
*   **Communication**: The different parts of the extension (popup, background script, injected scripts) communicate using the browser's extension messaging system.

## Installation and Setup

1.  **Download the Extension Files**:
    *   You'll need to have the extension files (manifest.json, popup.html, popup.js, background.js, etc.) in a folder on your computer. If you downloaded a ZIP file, extract it to a dedicated folder.

2.  **Install in Chrome (or Chromium-based browser)**:
    *   Open Chrome and navigate to `chrome://extensions`.
    *   Enable "Developer mode" using the toggle switch, usually found in the top-right corner.
    *   Click the "Load unpacked" button that appears.
    *   Select the folder where you saved/extracted the extension files.
    *   The "Hexroll Integration" extension should now appear in your list of extensions.

3.  **Prerequisites for Use**:
    *   **Hexroll.app Tab**: You need to have [Hexroll.app](https://5e.hexroll.app/) open in a browser tab, navigated to the specific hex, location, or map you want to process.
    *   **Foundry VTT Tab**: For features that interact with Foundry VTT, you must have your Foundry VTT game world open in another tab. The extension is configured to work with Foundry accessible at `https://theland.uber.space/game*`. Ensure this tab is active and your game world is loaded.
    *   **Pin the Extension (Recommended)**: Click the puzzle piece icon (Extensions) in your Chrome toolbar and then click the pin icon next to "Hexroll Integration" to make it easily accessible.

## Usage Guide

Once installed and set up, open the Hexroll.app page you wish to process. Click the Hexroll Integration extension icon in your browser toolbar to open the popup interface.

Here's what each button does:

*   **`Extract & Send Hex Data`**
    *   **Intended Hexroll Page**: Any Hexroll page displaying data for a specific hex or location (e.g., a particular hex on a regional map, a dungeon room, a settlement description).
    *   **Action**: Extracts the main title and content from the current Hexroll page. It formats the content with a visible public description and a collapsible "secret" section (ideal for GM-only notes). This data is then sent to your open Foundry VTT tab to create a new page within the "World" journal entry, or update an existing page if one with the same title already exists.
    *   **Prerequisites**: Hexroll page open, Foundry VTT tab open to `https://theland.uber.space/game*`.

*   **`Add to GM Notes (selected tile)`**
    *   **Intended Hexroll Page**: Any Hexroll page with content you want to associate with a map tile.
    *   **Action**: Extracts the raw HTML content (including any links) from the current Hexroll page. This content is then sent to Foundry VTT and added to the GM Notes field of the currently selected/controlled tile on the active canvas. If the page contains links to other Hexroll locations, this button also initiates the "Linked Location Processing" (see Core Features).
    *   **Prerequisites**: Hexroll page open, Foundry VTT tab open, and **a single tile must be selected/controlled on the Foundry VTT canvas**.

*   **`Create Merchant NPC`**
    *   **Intended Hexroll Page**: A Hexroll page specifically detailing a merchant, including their name, biography/description, and a table of items for sale.
    *   **Action**: Parses the merchant's name, bio, and item list (name and price) from the Hexroll page. It then creates a new NPC actor in Foundry VTT with this information. The extension will attempt to find items in SRD compendiums (like 'dnd5e.items') by name; if an item isn't found, a new basic 'loot' item will be created in the actor's inventory with the specified price.
    *   **Prerequisites**: Hexroll merchant page open, Foundry VTT tab open.

*   **`Dungeon/Town Scene Create (Screenshot)`**
    *   **Intended Hexroll Page**: A Hexroll page displaying a map (e.g., dungeon level, town layout, regional map).
    *   **Action**: Captures a PNG screenshot of the currently visible area of the Hexroll map. The image is automatically downloaded by your browser, named using the map's title (e.g., "Hexroll_Map_Location_Name_timestamp.png"). You can then upload this image into Foundry VTT to create a new scene or use it as a handout.
    *   **Prerequisites**: Hexroll map page open.

*   **`Toggle Secret Doors`**
    *   **Intended Hexroll Page**: A Hexroll SVG map page that might contain secret doors (often denoted by an 'S' symbol).
    *   **Action**: Toggles the visibility of these 'S' symbols on the Hexroll map directly in your browser. This does not permanently alter the map data but allows a GM to quickly hide/reveal them, for example, when screen sharing with players. A small style element is injected into the page to control visibility.
    *   **Prerequisites**: Hexroll SVG map page open.

## Permissions Justification

This extension requests the following permissions:

*   **`activeTab`**: Needed to allow the extension to interact with the currently active Hexroll.app page when you click the extension's popup buttons (e.g., to get its URL or inject scripts for data extraction).
*   **`scripting`**: Essential for injecting JavaScript code into both Hexroll.app and Foundry VTT web pages. This is how the extension reads data from Hexroll and performs actions (like creating journal entries or actors) in Foundry.
*   **`downloads`**: Used by the "Dungeon/Town Scene Create (Screenshot)" feature to download the captured map image to your computer.
*   **`host_permissions`**:
    *   `https://5e.hexroll.app/sandbox/*`: Grants explicit permission to interact with pages on the Hexroll.app domain, specifically within its "sandbox" path where content is typically displayed.
    *   `https://theland.uber.space/game*`: Grants explicit permission to interact with your Foundry VTT instance hosted at this specific URL. **Note**: If your Foundry VTT is hosted elsewhere, this URL would need to be adjusted in the `manifest.json` file and the extension reloaded.

## Known Issues & Limitations

*   **Sensitivity to Web Page Structure**: The extension relies on specific HTML element IDs and class names within Hexroll.app and the structure of the Foundry VTT interface (e.g., for interacting with journals, actors, and tiles). If Hexroll.app or Foundry VTT significantly changes its website structure, the extension's functionality may break or become unreliable until it's updated.
*   **Hardcoded Foundry VTT URL**: The URL for Foundry VTT (`https://theland.uber.space/game*`) is currently hardcoded in the `manifest.json` and various parts of the JavaScript code. If your Foundry VTT instance is hosted on a different domain or path, the extension will not be able to connect to it without modifying the source code.
*   **Foundry VTT System Compatibility**: While designed with D&D 5e in mind (e.g., SRD compendium names like `dnd5e.items`), the journal and actor creation should be relatively system-agnostic. However, specific item handling in merchant creation is 5e-focused.
*   **Error Handling**: While there is error handling, some edge cases or unexpected states in Hexroll or Foundry might not be caught gracefully. Status messages in the popup provide some feedback.
*   **Sequential Linked Location Processing**: The processing of linked locations navigates the main Hexroll tab sequentially. This can take some time if there are many links. The tab is unusable during this process, and you must wait for it to complete and return to the original page.
*   **No Automatic Updates**: As a manually loaded extension, it won't automatically update. You'll need to download and re-load newer versions if the code is updated.

## Contributing

Currently, there isn't a formal contribution process established. However, if you have suggestions, find bugs, or make improvements to the code, feel free to fork the repository (if applicable) or raise issues if a public repository exists for this project.
