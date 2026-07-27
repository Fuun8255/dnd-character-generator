"use strict";

const STORAGE_KEY = "dnd-character-generator-state";

const characterSections = [
    {
        key: "identity",
        title: "Identity",
        description: "What they are and where they came from.",
        defaultEnabled: true,
        fields: ["species", "characterClass", "background"]
    },
    {
        key: "history",
        title: "History",
        description: "What they did before adventuring and why they left.",
        defaultEnabled: true,
        fields: ["previousJob", "adventureReason"]
    },
    {
        key: "details",
        title: "Character Details",
        description: "Hooks that make the concept feel like a person instead of a stat block with shoes.",
        defaultEnabled: true,
        fields: ["definingMark", "personalityTrait", "secret"]
    },
    {
        key: "appearance",
        title: "Appearance",
        description: "Optional physical details. This section starts hidden.",
        defaultEnabled: false,
        fields: [
            "height",
            "build",
            "bodyColor",
            "eyeColor",
            "hairColor",
            "hairStyle"
        ]
    }
];

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
        optionsKey: "backgrounds",
        generator: generateBackground
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
    },
    {
        key: "height",
        label: "Height",
        generator: generateHeight
    },
    {
        key: "build",
        label: "Build",
        generator: generateBuild
    },
    {
        key: "bodyColor",
        label: "Skin / body colour",
        getLabel: getBodyColorLabel,
        generator: generateBodyColor
    },
    {
        key: "eyeColor",
        label: "Eye colour",
        generator: generateEyeColor
    },
    {
        key: "hairColor",
        label: "Hair colour",
        generator: generateHairColor
    },
    {
        key: "hairStyle",
        label: "Hair style",
        generator: generateHairStyle
    }
];

const fieldMap = new Map(
    characterFields.map(field => [field.key, field])
);

const sectionMap = new Map(
    characterSections.map(section => [section.key, section])
);

let characterOptions = {};
let currentCharacter = {};
let lockedFields = new Set();
let selectedTone = "any";
let selectedWeighting = "half";
let enabledSections = createDefaultSectionState();
let enabledFields = createDefaultFieldState();
let statusTimeoutId = null;

const resultElement = document.getElementById("character-result");
const summaryElement = document.getElementById("summary-text");
const statusElement = document.getElementById("status-message");
const generateButton = document.getElementById("generate-button");
const unlockAllButton = document.getElementById("unlock-all-button");
const resetButton = document.getElementById("reset-button");
const copyButton = document.getElementById("copy-button");
const toneSelect = document.getElementById("tone-select");
const weightingSelect = document.getElementById("weighting-select");

async function initialiseGenerator() {
    try {
        await loadCharacterOptions();
        loadSavedState();

        toneSelect.value = selectedTone;
        weightingSelect.value = selectedWeighting;

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
    const response = await fetch("./character-options.json");

    if (!response.ok) {
        throw new Error(
            `Failed to load character options: ${response.status}`
        );
    }

    characterOptions = await response.json();
    validateBackgroundAbilityScores();
}

function validateBackgroundAbilityScores() {
    const backgrounds = characterOptions.backgrounds ?? [];
    const mappings = characterOptions.backgroundAbilityScores ?? {};

    const missing = backgrounds.filter(background => {
        const scores = mappings[background];
        return !Array.isArray(scores) || scores.length !== 3;
    });

    if (missing.length > 0) {
        console.warn(
            "Backgrounds without three mapped ability scores:",
            missing
        );
    }
}

function createDefaultSectionState() {
    return Object.fromEntries(
        characterSections.map(section => [
            section.key,
            section.defaultEnabled
        ])
    );
}

function createDefaultFieldState() {
    return Object.fromEntries(
        characterFields.map(field => [field.key, true])
    );
}

function loadSavedState() {
    const savedStateText = localStorage.getItem(STORAGE_KEY);

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
            lockedFields = new Set(savedState.lockedFields);
        }

        if (typeof savedState.tone === "string") {
            selectedTone = savedState.tone;
        }

        if (
            ["full", "half", "random"].includes(
                savedState.weighting
            )
        ) {
            selectedWeighting = savedState.weighting;
        }

        if (
            savedState.enabledSections &&
            typeof savedState.enabledSections === "object"
        ) {
            enabledSections = {
                ...enabledSections,
                ...savedState.enabledSections
            };
        }

        if (
            savedState.enabledFields &&
            typeof savedState.enabledFields === "object"
        ) {
            enabledFields = {
                ...enabledFields,
                ...savedState.enabledFields
            };
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
        tone: selectedTone,
        weighting: selectedWeighting,
        enabledSections,
        enabledFields
    };

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
    );
}

function generateMissingFields() {
    for (const section of characterSections) {
        if (!isSectionEnabled(section.key)) {
            continue;
        }

        for (const fieldKey of section.fields) {
            if (!isFieldEnabled(fieldKey)) {
                continue;
            }

            if (!currentCharacter[fieldKey]) {
                currentCharacter[fieldKey] = generateField(fieldKey);
            }
        }
    }
}

function generateCharacter() {
    for (const section of characterSections) {
        rerollSectionData(section.key);
    }

    saveState();
    renderCharacter();
    updateSummary();

    showStatus("Generated a new character concept.");
}

function generateField(fieldKey, previousValue = null) {
    const field = fieldMap.get(fieldKey);

    if (!field) {
        console.error(`Unknown character field: ${fieldKey}`);
        return "Unknown";
    }

    if (typeof field.generator === "function") {
        return field.generator(previousValue);
    }

    return getRandomFieldValue(field, previousValue);
}

function getRandomFieldValue(field, previousValue = null) {
    const options = characterOptions[field.optionsKey];

    if (!Array.isArray(options)) {
        return "Unknown";
    }

    const eligibleOptions = getEligibleOptions(options);

    if (eligibleOptions.length === 0) {
        return "Unknown";
    }

    return getDifferentRandomOption(
        eligibleOptions,
        previousValue
    );
}

function getEligibleOptions(options) {
    if (selectedTone === "any") {
        return options;
    }

    const matchingOptions = options.filter(option => {
        if (typeof option === "string") {
            return true;
        }

        if (!Array.isArray(option.tones)) {
            return true;
        }

        return option.tones.includes(selectedTone);
    });

    return matchingOptions.length > 0
        ? matchingOptions
        : options;
}

function getDifferentRandomOption(options, previousValue = null) {
    const availableOptions = options.filter(
        option => getOptionText(option) !== previousValue
    );

    const randomPool = availableOptions.length > 0
        ? availableOptions
        : options;

    const randomIndex = Math.floor(
        Math.random() * randomPool.length
    );

    return getOptionText(randomPool[randomIndex]);
}

function getOptionText(option) {
    if (typeof option === "string") {
        return option;
    }

    if (option && typeof option.text === "string") {
        return option.text;
    }

    return "Unknown";
}

function generateBackground(previousValue = null) {
    const backgrounds = characterOptions.backgrounds;

    if (!Array.isArray(backgrounds) || backgrounds.length === 0) {
        return "Unknown";
    }

    const availableBackgrounds = backgrounds.filter(
        background => background !== previousValue
    );

    const pool = availableBackgrounds.length > 0
        ? availableBackgrounds
        : backgrounds;

    if (selectedWeighting === "random") {
        return pool[Math.floor(Math.random() * pool.length)];
    }

    const className = (
        isSectionEnabled("identity") &&
        isFieldEnabled("characterClass")
    )
        ? currentCharacter.characterClass
        : "";

    const baseClass = getBaseClassName(className);

    const classWeights =
        characterOptions.classAbilityWeights?.[baseClass];

    if (!classWeights) {
        return pool[Math.floor(Math.random() * pool.length)];
    }

    return weightedRandom(
        pool,
        background => getBackgroundWeight(
            background,
            classWeights
        )
    );
}

function getBaseClassName(className) {
    if (typeof className !== "string") {
        return "";
    }

    return className.split(":")[0].trim();
}

function getBackgroundWeight(background, classWeights) {
    const abilityScores =
        characterOptions.backgroundAbilityScores?.[background];

    let fullWeight;

    if (Array.isArray(abilityScores) && abilityScores.length > 0) {
        const scores = abilityScores
            .map(ability => classWeights[ability] ?? 0)
            .sort((a, b) => b - a);

        const best = scores[0] ?? 0;
        const secondBest = scores[1] ?? 0;

        fullWeight = 1 + best + (secondBest * 0.45);
    } else {
        /*
         * Future or custom backgrounds without mapped ability-score
         * options stay possible, but do not receive a class-match bonus.
         */
        fullWeight = 1;
    }

    return adjustWeight(fullWeight, selectedWeighting);
}

function adjustWeight(weight, mode) {
    if (mode === "random") {
        return 1;
    }

    if (mode === "half") {
        return 1 + ((weight - 1) * 0.35);
    }

    return weight;
}

function weightedRandom(items, getWeight) {
    const weightedItems = items.map(item => ({
        item,
        weight: Math.max(0, Number(getWeight(item)) || 0)
    }));

    const totalWeight = weightedItems.reduce(
        (total, entry) => total + entry.weight,
        0
    );

    if (totalWeight <= 0) {
        return items[Math.floor(Math.random() * items.length)];
    }

    let roll = Math.random() * totalWeight;

    for (const entry of weightedItems) {
        roll -= entry.weight;

        if (roll <= 0) {
            return entry.item;
        }
    }

    return weightedItems[weightedItems.length - 1].item;
}

function generateHeight(previousValue = null) {
    const species = getAppearanceSpecies();
    const profiles =
        characterOptions.appearanceOptions?.heightProfiles ?? [];

    const profile = profiles.find(item =>
        Array.isArray(item.contains) &&
        item.contains.some(text => species.includes(text))
    );

    const minCm = profile?.minCm ?? 145;
    const maxCm = profile?.maxCm ?? 205;

    for (let attempt = 0; attempt < 8; attempt += 1) {
        const spread = (Math.random() + Math.random()) / 2;
        const cm = Math.round(
            minCm + (spread * (maxCm - minCm))
        );

        const value = `${cm} cm / ${cmToFeetAndInches(cm)}`;

        if (value !== previousValue) {
            return value;
        }
    }

    const fallbackCm = Math.round((minCm + maxCm) / 2);
    return `${fallbackCm} cm / ${cmToFeetAndInches(fallbackCm)}`;
}

function cmToFeetAndInches(cm) {
    const totalInches = Math.round(cm / 2.54);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;

    return `${feet}'${inches}\"`;
}

function generateBuild(previousValue = null) {
    return getAppearanceOption("builds", previousValue);
}

function generateBodyColor(previousValue = null) {
    const species = getAppearanceSpecies();
    const category = getBodyColorCategory(species);

    return getAppearanceOption(category, previousValue);
}

function getBodyColorCategory(species) {
    if (matchesSpecies(species, ["Warforged", "Autognome"])) {
        return "constructFinishes";
    }

    if (matchesSpecies(species, ["Plasmoid"])) {
        return "oozeColors";
    }

    if (matchesSpecies(species, ["Thri-kreen"])) {
        return "carapaceColors";
    }

    if (matchesSpecies(species, [
        "Aarakocra",
        "Kenku",
        "Owlin"
    ])) {
        return "featherColors";
    }

    if (matchesSpecies(species, [
        "Tabaxi",
        "Leonin",
        "Lupin"
    ])) {
        return "furColors";
    }

    if (matchesSpecies(species, [
        "Dragonborn",
        "Kobold",
        "Lizardfolk",
        "Tortle",
        "Grung"
    ])) {
        return "scaleColors";
    }

    if (matchesSpecies(species, [
        "Genasi",
        "Tiefling",
        "Aasimar",
        "Eladrin",
        "Shadar-kai",
        "Dhampir",
        "Hexblood",
        "Reborn"
    ])) {
        return "fantasySkinColors";
    }

    return "skinColors";
}

function getBodyColorLabel() {
    const species = getAppearanceSpecies();

    if (matchesSpecies(species, ["Warforged", "Autognome"])) {
        return "Body finish";
    }

    if (matchesSpecies(species, ["Plasmoid"])) {
        return "Body colour";
    }

    if (matchesSpecies(species, ["Thri-kreen"])) {
        return "Carapace";
    }

    if (matchesSpecies(species, ["Aarakocra", "Kenku", "Owlin"])) {
        return "Plumage";
    }

    if (matchesSpecies(species, ["Tabaxi", "Leonin", "Lupin"])) {
        return "Fur";
    }

    if (matchesSpecies(species, [
        "Dragonborn",
        "Kobold",
        "Lizardfolk",
        "Grung"
    ])) {
        return "Scales";
    }

    if (matchesSpecies(species, ["Tortle"])) {
        return "Shell / skin";
    }

    return "Skin colour";
}

function generateEyeColor(previousValue = null) {
    const species = getAppearanceSpecies();
    const unusualSpecies = matchesSpecies(species, [
        "Aasimar",
        "Dragonborn",
        "Genasi",
        "Tiefling",
        "Eladrin",
        "Shadar-kai",
        "Dhampir",
        "Hexblood",
        "Reborn",
        "Warforged",
        "Autognome",
        "Plasmoid"
    ]);

    const category = unusualSpecies && Math.random() < 0.55
        ? "unusualEyeColors"
        : "eyeColors";

    return getAppearanceOption(category, previousValue);
}

function generateHairColor(previousValue = null) {
    if (!speciesUsuallyHasHair(getAppearanceSpecies())) {
        return "None";
    }

    return getAppearanceOption("hairColors", previousValue);
}

function generateHairStyle(previousValue = null) {
    if (!speciesUsuallyHasHair(getAppearanceSpecies())) {
        return "None";
    }

    return getAppearanceOption("hairStyles", previousValue);
}

function speciesUsuallyHasHair(species) {
    return !matchesSpecies(species, [
        "Aarakocra",
        "Autognome",
        "Dragonborn",
        "Grung",
        "Kenku",
        "Kobold",
        "Lizardfolk",
        "Locathah",
        "Owlin",
        "Plasmoid",
        "Thri-kreen",
        "Tortle",
        "Warforged"
    ]);
}

function getAppearanceSpecies() {
    if (
        !isSectionEnabled("identity") ||
        !isFieldEnabled("species")
    ) {
        return "";
    }

    return currentCharacter.species ?? "";
}

function matchesSpecies(species, fragments) {
    return fragments.some(fragment => species.includes(fragment));
}

function getAppearanceOption(category, previousValue = null) {
    const options =
        characterOptions.appearanceOptions?.[category];

    if (!Array.isArray(options) || options.length === 0) {
        return "Unknown";
    }

    return getDifferentRandomOption(options, previousValue);
}

function rerollField(fieldKey) {
    if (!isFieldEnabled(fieldKey)) {
        showStatus("Show that field before rerolling it.");
        return;
    }

    if (lockedFields.has(fieldKey)) {
        showStatus("Unlock that category before rerolling it.");
        return;
    }

    const field = fieldMap.get(fieldKey);

    if (!field) {
        console.error(`Unknown character field: ${fieldKey}`);
        return;
    }

    currentCharacter[fieldKey] = generateField(
        fieldKey,
        currentCharacter[fieldKey]
    );

    saveState();
    renderCharacter();
    updateSummary();

    showStatus(`${getFieldLabel(field)} rerolled.`);
}

function rerollSection(sectionKey) {
    const section = sectionMap.get(sectionKey);

    if (!section || !isSectionEnabled(sectionKey)) {
        return;
    }

    rerollSectionData(sectionKey);

    saveState();
    renderCharacter();
    updateSummary();

    showStatus(`${section.title} rerolled.`);
}

function rerollSectionData(sectionKey) {
    const section = sectionMap.get(sectionKey);

    if (!section || !isSectionEnabled(sectionKey)) {
        return;
    }

    for (const fieldKey of section.fields) {
        if (!isFieldEnabled(fieldKey)) {
            continue;
        }

        const isLocked = lockedFields.has(fieldKey);
        const hasValue = Boolean(currentCharacter[fieldKey]);

        if (isLocked && hasValue) {
            continue;
        }

        currentCharacter[fieldKey] = generateField(
            fieldKey,
            currentCharacter[fieldKey]
        );
    }
}

function toggleFieldLock(fieldKey) {
    if (lockedFields.has(fieldKey)) {
        lockedFields.delete(fieldKey);
    } else {
        lockedFields.add(fieldKey);
    }

    saveState();
    renderCharacter();
}

function unlockAllFields() {
    lockedFields.clear();

    saveState();
    renderCharacter();

    showStatus("All categories unlocked.");
}

function setFieldEnabled(fieldKey, isEnabled) {
    if (!(fieldKey in enabledFields)) {
        return;
    }

    enabledFields[fieldKey] = isEnabled;

    if (isEnabled && !currentCharacter[fieldKey]) {
        currentCharacter[fieldKey] = generateField(fieldKey);
    }

    saveState();
    renderCharacter();
    updateSummary();

    const field = fieldMap.get(fieldKey);
    showStatus(
        `${getFieldLabel(field)} ${isEnabled ? "shown" : "hidden"}.`
    );
}

function toggleSection(sectionKey) {
    const section = sectionMap.get(sectionKey);

    if (!section) {
        return;
    }

    const newState = !isSectionEnabled(sectionKey);
    enabledSections[sectionKey] = newState;

    if (newState) {
        for (const fieldKey of section.fields) {
            if (
                isFieldEnabled(fieldKey) &&
                !currentCharacter[fieldKey]
            ) {
                currentCharacter[fieldKey] = generateField(fieldKey);
            }
        }
    }

    saveState();
    renderCharacter();
    updateSummary();

    showStatus(
        `${section.title} ${newState ? "shown" : "hidden"}.`
    );
}

function isSectionEnabled(sectionKey) {
    return enabledSections[sectionKey] !== false;
}

function isFieldEnabled(fieldKey) {
    return enabledFields[fieldKey] !== false;
}

function resetEverything() {
    currentCharacter = {};
    lockedFields.clear();
    selectedTone = "any";
    selectedWeighting = "half";
    enabledSections = createDefaultSectionState();
    enabledFields = createDefaultFieldState();

    toneSelect.value = selectedTone;
    weightingSelect.value = selectedWeighting;

    localStorage.removeItem(STORAGE_KEY);

    generateMissingFields();
    saveState();
    renderCharacter();
    updateSummary();

    showStatus("Generator reset.");
}

function renderCharacter() {
    resultElement.replaceChildren();

    for (const section of characterSections) {
        resultElement.append(createSectionElement(section));
    }
}

function createSectionElement(section) {
    const sectionElement = document.createElement("section");

    sectionElement.className = "character-section";
    sectionElement.dataset.section = section.key;

    const enabled = isSectionEnabled(section.key);

    sectionElement.classList.toggle("is-disabled", !enabled);

    const header = document.createElement("div");
    header.className = "section-header";

    const heading = document.createElement("div");
    heading.className = "section-heading";

    const title = document.createElement("h2");
    title.textContent = section.title;

    const description = document.createElement("p");
    description.className = "section-description";
    description.textContent = section.description;

    heading.append(title, description);

    const actions = document.createElement("div");
    actions.className = "section-actions";

    const rerollButton = document.createElement("button");
    rerollButton.className = "section-button";
    rerollButton.type = "button";
    rerollButton.textContent = `Reroll ${section.title}`;
    rerollButton.disabled = !enabled;
    rerollButton.addEventListener("click", () => {
        rerollSection(section.key);
    });

    const visibilityButton = document.createElement("button");
    visibilityButton.className = "section-button";
    visibilityButton.type = "button";
    visibilityButton.textContent = enabled
        ? `Hide ${section.title}`
        : `Show ${section.title}`;
    visibilityButton.setAttribute("aria-pressed", String(enabled));
    visibilityButton.addEventListener("click", () => {
        toggleSection(section.key);
    });

    actions.append(rerollButton, visibilityButton);
    header.append(heading, actions);
    sectionElement.append(header);

    if (!enabled) {
        const message = document.createElement("p");
        message.className = "section-empty";
        message.textContent =
            "This section is hidden. It will not be rerolled or included when you copy the character.";
        sectionElement.append(message);
        return sectionElement;
    }

    const fieldsContainer = document.createElement("div");
    fieldsContainer.className = "section-fields";

    const visibleFields = section.fields.filter(isFieldEnabled);

    if (visibleFields.length === 0) {
        const message = document.createElement("p");
        message.className = "section-empty";
        message.textContent =
            "Every field in this section is hidden. Humanity has achieved configurable absence.";
        fieldsContainer.append(message);
    } else {
        for (const fieldKey of visibleFields) {
            const field = fieldMap.get(fieldKey);

            if (field) {
                fieldsContainer.append(createCharacterEntry(field));
            }
        }
    }

    sectionElement.append(fieldsContainer);

    const hiddenFields = section.fields.filter(
        fieldKey => !isFieldEnabled(fieldKey)
    );

    if (hiddenFields.length > 0) {
        sectionElement.append(
            createHiddenFieldsControls(hiddenFields)
        );
    }

    return sectionElement;
}

function createHiddenFieldsControls(hiddenFieldKeys) {
    const container = document.createElement("div");
    container.className = "hidden-fields";

    const label = document.createElement("span");
    label.className = "hidden-fields-label";
    label.textContent = "Hidden fields:";
    container.append(label);

    for (const fieldKey of hiddenFieldKeys) {
        const field = fieldMap.get(fieldKey);

        if (!field) {
            continue;
        }

        const button = document.createElement("button");
        button.className = "hidden-field-button";
        button.type = "button";
        button.textContent = `Show ${getFieldLabel(field)}`;
        button.addEventListener("click", () => {
            setFieldEnabled(fieldKey, true);
        });

        container.append(button);
    }

    return container;
}

function createCharacterEntry(field) {
    const entry = document.createElement("div");

    entry.className = "character-entry";
    entry.dataset.field = field.key;

    const isLocked = lockedFields.has(field.key);
    entry.classList.toggle("is-locked", isLocked);

    const labelElement = document.createElement("span");
    labelElement.className = "character-label";
    labelElement.textContent = getFieldLabel(field);

    const contentElement = document.createElement("div");
    contentElement.className = "character-content";

    const valueElement = document.createElement("p");
    valueElement.className = "character-value";
    valueElement.textContent =
        currentCharacter[field.key] ?? "Unknown";

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "field-buttons";

    const rerollButton = createRerollButton(field, isLocked);
    const lockButton = createLockButton(field, isLocked);
    const hideButton = createHideButton(field);

    buttonContainer.append(
        rerollButton,
        lockButton,
        hideButton
    );

    contentElement.append(valueElement, buttonContainer);
    entry.append(labelElement, contentElement);

    return entry;
}

function createRerollButton(field, isLocked) {
    const button = document.createElement("button");

    button.className = "field-button reroll-button";
    button.type = "button";
    button.textContent = "Reroll";
    button.disabled = isLocked;

    button.title = isLocked
        ? `Unlock ${getFieldLabel(field)} before rerolling`
        : `Reroll ${getFieldLabel(field)}`;

    button.setAttribute("aria-label", button.title);

    button.addEventListener("click", () => {
        rerollField(field.key);
    });

    return button;
}

function createLockButton(field, isLocked) {
    const button = document.createElement("button");

    button.className = "field-button lock-button";
    button.type = "button";
    button.textContent = isLocked ? "Unlock" : "Lock";
    button.classList.toggle("locked", isLocked);

    button.title = isLocked
        ? `Unlock ${getFieldLabel(field)}`
        : `Lock ${getFieldLabel(field)}`;

    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(isLocked));

    button.addEventListener("click", () => {
        toggleFieldLock(field.key);
    });

    return button;
}

function createHideButton(field) {
    const button = document.createElement("button");

    button.className = "field-button hide-button";
    button.type = "button";
    button.textContent = "Hide";
    button.title = `Hide ${getFieldLabel(field)}`;
    button.setAttribute("aria-label", button.title);

    button.addEventListener("click", () => {
        setFieldEnabled(field.key, false);
    });

    return button;
}

function getFieldLabel(field) {
    if (!field) {
        return "Field";
    }

    if (typeof field.getLabel === "function") {
        return field.getLabel();
    }

    return field.label;
}

function createCharacterSummary() {
    const sentences = [];

    const species = getVisibleValue("species");
    const characterClass = getVisibleValue("characterClass");
    const background = getVisibleValue("background");

    if (species || characterClass || background) {
        let identity = "This character";

        if (species && characterClass) {
            identity = `This ${species} ${characterClass}`;
        } else if (species) {
            identity = `This ${species}`;
        } else if (characterClass) {
            identity = `This ${characterClass}`;
        }

        if (background) {
            identity += ` has the ${background} background`;
        }

        sentences.push(`${identity}.`);
    }

    const previousJob = getVisibleValue("previousJob");
    const adventureReason = getVisibleValue("adventureReason");

    if (previousJob) {
        sentences.push(`They previously worked as ${previousJob}.`);
    }

    if (adventureReason) {
        sentences.push(`They became an adventurer ${adventureReason}.`);
    }

    const definingMark = getVisibleValue("definingMark");
    const personality = getVisibleValue("personalityTrait");
    const secret = getVisibleValue("secret");

    if (definingMark) {
        sentences.push(`Their defining mark is ${definingMark}.`);
    }

    if (personality) {
        sentences.push(`They are ${personality}.`);
    }

    if (secret) {
        sentences.push(`Secretly, ${secret}.`);
    }

    const appearanceParts = [];

    for (const fieldKey of [
        "height",
        "build",
        "bodyColor",
        "eyeColor",
        "hairColor",
        "hairStyle"
    ]) {
        const value = getVisibleValue(fieldKey);

        if (!value) {
            continue;
        }

        const field = fieldMap.get(fieldKey);
        appearanceParts.push(
            `${getFieldLabel(field).toLowerCase()}: ${value}`
        );
    }

    if (appearanceParts.length > 0) {
        sentences.push(
            `Appearance: ${appearanceParts.join(", ")}.`
        );
    }

    if (sentences.length === 0) {
        return "No visible character fields are currently enabled.";
    }

    return sentences.join(" ");
}

function getVisibleValue(fieldKey) {
    const section = getSectionForField(fieldKey);

    if (
        !section ||
        !isSectionEnabled(section.key) ||
        !isFieldEnabled(fieldKey)
    ) {
        return null;
    }

    return currentCharacter[fieldKey] ?? null;
}

function getSectionForField(fieldKey) {
    return characterSections.find(
        section => section.fields.includes(fieldKey)
    );
}

function updateSummary() {
    summaryElement.textContent = createCharacterSummary();
}

function createCopyText() {
    const lines = [];

    for (const section of characterSections) {
        if (!isSectionEnabled(section.key)) {
            continue;
        }

        const visibleFields = section.fields.filter(
            fieldKey => isFieldEnabled(fieldKey)
        );

        if (visibleFields.length === 0) {
            continue;
        }

        lines.push(section.title.toUpperCase());

        for (const fieldKey of visibleFields) {
            const field = fieldMap.get(fieldKey);

            if (!field) {
                continue;
            }

            const value = currentCharacter[fieldKey] ?? "Unknown";
            lines.push(`${getFieldLabel(field)}: ${value}`);
        }

        lines.push("");
    }

    lines.push("CHARACTER CONCEPT");
    lines.push(createCharacterSummary());

    return lines.join("\n").trim();
}

async function copyCharacter() {
    const text = createCopyText();

    try {
        await copyTextToClipboard(text);

        showStatus("Character copied to the clipboard.");

        temporarilyChangeButtonText(
            copyButton,
            "Copied!"
        );
    } catch (error) {
        console.error(error);
        showStatus("The character could not be copied.");
    }
}

async function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textArea = document.createElement("textarea");

    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";

    document.body.append(textArea);

    textArea.focus();
    textArea.select();

    const copied = document.execCommand("copy");

    textArea.remove();

    if (!copied) {
        throw new Error("Clipboard fallback failed.");
    }
}

function temporarilyChangeButtonText(button, temporaryText) {
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

generateButton.addEventListener("click", generateCharacter);
unlockAllButton.addEventListener("click", unlockAllFields);
resetButton.addEventListener("click", resetEverything);
copyButton.addEventListener("click", copyCharacter);

toneSelect.addEventListener("change", event => {
    selectedTone = event.target.value;

    generateCharacter();

    showStatus(
        `Tone changed to ${event.target.options[
            event.target.selectedIndex
        ].text}.`
    );
});

weightingSelect.addEventListener("change", event => {
    selectedWeighting = event.target.value;

    const backgroundSection = getSectionForField("background");

    if (
        backgroundSection &&
        isSectionEnabled(backgroundSection.key) &&
        isFieldEnabled("background") &&
        !lockedFields.has("background")
    ) {
        currentCharacter.background = generateBackground(
            currentCharacter.background
        );
    }

    saveState();
    renderCharacter();
    updateSummary();

    showStatus(
        `Background logic changed to ${event.target.options[
            event.target.selectedIndex
        ].text}.`
    );
});

initialiseGenerator();
