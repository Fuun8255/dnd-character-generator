"use strict";

const STORAGE_KEY = "dnd-character-generator-state";

const characterFields = [
    {
        key: "species",
        label: "Species",
        optionsKey: "species"
    },
{
    key: "characterClass",
    label: "Class",
    optionsKey: "classes"
},
{
    key: "background",
    label: "Background",
    optionsKey: "backgrounds"
},
{
    key: "previousJob",
    label: "Previous profession",
    optionsKey: "previousJobs"
},
{
    key: "adventureReason",
    label: "Reason for adventuring",
    optionsKey: "adventureReasons"
},
{
    key: "definingMark",
    label: "Defining mark",
    optionsKey: "definingMarks"
},
{
    key: "personalityTrait",
    label: "Personality",
    optionsKey: "personalityTraits"
},
{
    key: "secret",
    label: "Secret",
    optionsKey: "secrets"
}
];

let characterOptions = {};

let currentCharacter = {};

let lockedFields = new Set();

let selectedTone = "any";

let statusTimeoutId = null;

const resultElement = document.getElementById(
    "character-result"
);

const summaryElement = document.getElementById(
    "summary-text"
);

const statusElement = document.getElementById(
    "status-message"
);

const generateButton = document.getElementById(
    "generate-button"
);

const unlockAllButton = document.getElementById(
    "unlock-all-button"
);

const resetButton = document.getElementById(
    "reset-button"
);

const copyButton = document.getElementById(
    "copy-button"
);

const toneSelect = document.getElementById(
    "tone-select"
);

async function initialiseGenerator() {
    try {
        await loadCharacterOptions();
        loadSavedState();

        toneSelect.value = selectedTone;

        generateMissingFields();
        renderCharacter();
        updateSummary();
        saveState();
    } catch (error) {
        console.error(error);

        resultElement.innerHTML = `
        <p class="placeholder">
        The character options could not be loaded.
        Make sure the website is running through a local server.
        </p>
        `;

        showStatus("Failed to load character data.");
    }
}

async function loadCharacterOptions() {
    const response = await fetch(
        "./data/character-options.json"
    );

    if (!response.ok) {
        throw new Error(
            `Failed to load character options: ${response.status}`
        );
    }

    characterOptions = await response.json();
}

function loadSavedState() {
    const savedStateText = localStorage.getItem(
        STORAGE_KEY
    );

    if (!savedStateText) {
        return;
    }

    try {
        const savedState = JSON.parse(savedStateText);

        if (
            savedState.character &&
            typeof savedState.character === "object"
        ) {
            currentCharacter = savedState.character;
        }

        if (Array.isArray(savedState.lockedFields)) {
            lockedFields = new Set(
                savedState.lockedFields
            );
        }

        if (typeof savedState.tone === "string") {
            selectedTone = savedState.tone;
        }
    } catch (error) {
        console.error(
            "Could not read saved generator state:",
            error
        );

        localStorage.removeItem(STORAGE_KEY);
    }
}

function saveState() {
    const state = {
        character: currentCharacter,
        lockedFields: [...lockedFields],
        tone: selectedTone
    };

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
    );
}

function generateMissingFields() {
    for (const field of characterFields) {
        if (!currentCharacter[field.key]) {
            currentCharacter[field.key] =
            getRandomFieldValue(field);
        }
    }
}

function generateCharacter() {
    for (const field of characterFields) {
        const isLocked = lockedFields.has(field.key);
        const hasValue = Boolean(
            currentCharacter[field.key]
        );

        if (isLocked && hasValue) {
            continue;
        }

        currentCharacter[field.key] =
        getRandomFieldValue(
            field,
            currentCharacter[field.key]
        );
    }

    saveState();
    renderCharacter();
    updateSummary();

    showStatus("Generated a new character concept.");
}

function getRandomFieldValue(
    field,
    previousValue = null
) {
    const options =
    characterOptions[field.optionsKey];

    if (!Array.isArray(options)) {
        return "Unknown";
    }

    const eligibleOptions =
    getEligibleOptions(options);

    if (eligibleOptions.length === 0) {
        return "Unknown";
    }

    const availableOptions =
    eligibleOptions.filter(
        option => getOptionText(option) !== previousValue
    );

    const randomPool =
    availableOptions.length > 0
    ? availableOptions
    : eligibleOptions;

    const randomIndex = Math.floor(
        Math.random() * randomPool.length
    );

    return getOptionText(randomPool[randomIndex]);
}

function getEligibleOptions(options) {
    if (selectedTone === "any") {
        return options;
    }

    const matchingOptions = options.filter(option => {
        /*
         * Plain text options, such as species and classes,
         * are available for every tone.
         */
        if (typeof option === "string") {
            return true;
        }

        if (!Array.isArray(option.tones)) {
            return true;
        }

        return option.tones.includes(selectedTone);
    });

    /*
     * Fall back to the full list if a category has no
     * entries for the selected tone.
     */
    return matchingOptions.length > 0
    ? matchingOptions
    : options;
}

function getOptionText(option) {
    if (typeof option === "string") {
        return option;
    }

    if (
        option &&
        typeof option.text === "string"
    ) {
        return option.text;
    }

    return "Unknown";
}

function rerollField(fieldKey) {
    if (lockedFields.has(fieldKey)) {
        showStatus(
            "Unlock that category before rerolling it."
        );

        return;
    }

    const field = characterFields.find(
        item => item.key === fieldKey
    );

    if (!field) {
        console.error(
            `Unknown character field: ${fieldKey}`
        );

        return;
    }

    currentCharacter[field.key] =
    getRandomFieldValue(
        field,
        currentCharacter[field.key]
    );

    saveState();
    updateFieldDisplay(field.key);
    updateSummary();

    showStatus(`${field.label} rerolled.`);
}

function toggleFieldLock(fieldKey) {
    if (lockedFields.has(fieldKey)) {
        lockedFields.delete(fieldKey);
    } else {
        lockedFields.add(fieldKey);
    }

    saveState();
    updateFieldControls(fieldKey);
}

function unlockAllFields() {
    lockedFields.clear();

    saveState();
    renderCharacter();

    showStatus("All categories unlocked.");
}

function resetEverything() {
    currentCharacter = {};
    lockedFields.clear();
    selectedTone = "any";

    toneSelect.value = "any";

    localStorage.removeItem(STORAGE_KEY);

    generateCharacter();

    showStatus("Generator reset.");
}

function renderCharacter() {
    resultElement.replaceChildren();

    for (const field of characterFields) {
        const entry = createCharacterEntry(field);
        resultElement.append(entry);
    }
}

function createCharacterEntry(field) {
    const entry = document.createElement("div");

    entry.className = "character-entry";
    entry.dataset.field = field.key;

    const labelElement =
    document.createElement("span");

    labelElement.className = "character-label";
    labelElement.textContent = field.label;

    const contentElement =
    document.createElement("div");

    contentElement.className = "character-content";

    const valueElement =
    document.createElement("p");

    valueElement.className = "character-value";

    valueElement.textContent =
    currentCharacter[field.key] ?? "Unknown";

    const buttonContainer =
    document.createElement("div");

    buttonContainer.className = "field-buttons";

    const rerollButton =
    createRerollButton(field);

    const lockButton =
    createLockButton(field);

    buttonContainer.append(
        rerollButton,
        lockButton
    );

    contentElement.append(
        valueElement,
        buttonContainer
    );

    entry.append(
        labelElement,
        contentElement
    );

    updateControlsForEntry(entry, field);

    return entry;
}

function createRerollButton(field) {
    const button =
    document.createElement("button");

    button.className =
    "field-button reroll-button";

    button.type = "button";
    button.textContent = "Reroll";

    button.addEventListener("click", () => {
        rerollField(field.key);
    });

    return button;
}

function createLockButton(field) {
    const button =
    document.createElement("button");

    button.className =
    "field-button lock-button";

    button.type = "button";

    button.addEventListener("click", () => {
        toggleFieldLock(field.key);
    });

    return button;
}

function updateFieldDisplay(fieldKey) {
    const entry = getFieldEntry(fieldKey);

    if (!entry) {
        return;
    }

    const valueElement = entry.querySelector(
        ".character-value"
    );

    if (valueElement) {
        valueElement.textContent =
        currentCharacter[fieldKey] ?? "Unknown";
    }
}

function updateFieldControls(fieldKey) {
    const entry = getFieldEntry(fieldKey);

    if (!entry) {
        return;
    }

    const field = characterFields.find(
        item => item.key === fieldKey
    );

    if (!field) {
        return;
    }

    updateControlsForEntry(entry, field);
}

function updateControlsForEntry(entry, field) {
    const isLocked =
    lockedFields.has(field.key);

    const rerollButton = entry.querySelector(
        ".reroll-button"
    );

    const lockButton = entry.querySelector(
        ".lock-button"
    );

    entry.classList.toggle(
        "is-locked",
        isLocked
    );

    if (rerollButton) {
        rerollButton.disabled = isLocked;

        rerollButton.title = isLocked
        ? `Unlock ${field.label} before rerolling`
        : `Reroll ${field.label}`;

        rerollButton.setAttribute(
            "aria-label",
            rerollButton.title
        );
    }

    if (lockButton) {
        lockButton.textContent = isLocked
        ? "Unlock"
        : "Lock";

        lockButton.classList.toggle(
            "locked",
            isLocked
        );

        lockButton.title = isLocked
        ? `Unlock ${field.label}`
        : `Lock ${field.label}`;

        lockButton.setAttribute(
            "aria-label",
            lockButton.title
        );

        lockButton.setAttribute(
            "aria-pressed",
            String(isLocked)
        );
    }
}

function getFieldEntry(fieldKey) {
    return document.querySelector(
        `.character-entry[data-field="${fieldKey}"]`
    );
}

function createCharacterSummary() {
    const species =
    currentCharacter.species;

    const characterClass =
    currentCharacter.characterClass;

    const background =
    currentCharacter.background;

    const previousJob =
    currentCharacter.previousJob;

    const adventureReason =
    currentCharacter.adventureReason;

    const definingMark =
    currentCharacter.definingMark;

    const personality =
    currentCharacter.personalityTrait;

    const secret =
    currentCharacter.secret;

    if (
        !species ||
        !characterClass ||
        !background
    ) {
        return "Generate a character to create a combined description.";
    }

    return (
        `This ${species} ${characterClass} has the ` +
        `${background} background and previously worked as ` +
        `${previousJob}. They became an adventurer ` +
        `${adventureReason}. Their defining mark is ` +
        `${definingMark}. They are ${personality}. ` +
        `Secretly, ${secret}.`
    );
}

function updateSummary() {
    summaryElement.textContent =
    createCharacterSummary();
}

function createCopyText() {
    const lines = characterFields.map(field => {
        const value =
        currentCharacter[field.key] ?? "Unknown";

        return `${field.label}: ${value}`;
    });

    lines.push("");
    lines.push("Character Concept:");
    lines.push(createCharacterSummary());

    return lines.join("\n");
}

async function copyCharacter() {
    const text = createCopyText();

    try {
        await copyTextToClipboard(text);

        showStatus(
            "Character copied to the clipboard."
        );

        temporarilyChangeButtonText(
            copyButton,
            "Copied!"
        );
    } catch (error) {
        console.error(error);

        showStatus(
            "The character could not be copied."
        );
    }
}

async function copyTextToClipboard(text) {
    if (
        navigator.clipboard &&
        window.isSecureContext
    ) {
        await navigator.clipboard.writeText(text);
        return;
    }

    /*
     * Fallback for browsers or local environments where
     * the modern Clipboard API is unavailable.
     */
    const textArea =
    document.createElement("textarea");

    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";

    document.body.append(textArea);

    textArea.focus();
    textArea.select();

    const copied =
    document.execCommand("copy");

    textArea.remove();

    if (!copied) {
        throw new Error(
            "Clipboard fallback failed."
        );
    }
}

function temporarilyChangeButtonText(
    button,
    temporaryText
) {
    const originalText = button.textContent;

    button.textContent = temporaryText;
    button.disabled = true;

    window.setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
    }, 1200);
}

function showStatus(message) {
    statusElement.textContent = message;

    if (statusTimeoutId) {
        window.clearTimeout(statusTimeoutId);
    }

    statusTimeoutId = window.setTimeout(() => {
        statusElement.textContent = "";
    }, 2500);
}

generateButton.addEventListener(
    "click",
    generateCharacter
);

unlockAllButton.addEventListener(
    "click",
    unlockAllFields
);

resetButton.addEventListener(
    "click",
    resetEverything
);

copyButton.addEventListener(
    "click",
    copyCharacter
);

toneSelect.addEventListener(
    "change",
    event => {
        selectedTone = event.target.value;

        /*
         * Locked fields remain untouched.
         * Unlocked fields are regenerated using the new tone.
         */
        generateCharacter();

        showStatus(
            `Tone changed to ${event.target.options[
                event.target.selectedIndex
            ].text}.`
        );
    }
);

initialiseGenerator();
