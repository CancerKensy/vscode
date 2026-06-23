let players = JSON.parse(localStorage.getItem("players")) || [];
let currentGame = JSON.parse(localStorage.getItem("currentGame")) || null;
if (currentGame && !currentGame.forcedTurnQueue) {
    currentGame.forcedTurnQueue = [];
}

if (currentGame && currentGame.forcedTurnActive === undefined) {
    currentGame.forcedTurnActive = false;
}

if (currentGame && currentGame.forcedTurnPosition !== undefined) {
    delete currentGame.forcedTurnPosition;
}
if (currentGame && !currentGame.fieldCounts) {
    currentGame.fieldCounts = createEmptyFieldCounts();
}
if (currentGame && !currentGame.playerCaps) {
    currentGame.playerCaps = createInitialPlayerCaps();
}
if (currentGame && !currentGame.teamEraserUsed) {
    currentGame.teamEraserUsed = createInitialTeamErasers();
}
if (currentGame && currentGame.awaitingNextRound === undefined) {
    currentGame.awaitingNextRound = false;
}

if (currentGame && currentGame.keepStartPlayerForNextRound === undefined) {
    currentGame.keepStartPlayerForNextRound = false;
}
if (currentGame && !currentGame.playerBeers) {
    currentGame.playerBeers = createInitialPlayerBeers();
}

if (
    currentGame &&
    !Number.isInteger(currentGame.beerWinnerTeamIndex)
) {
    currentGame.beerWinnerTeamIndex = null;
}
if (currentGame && !currentGame.roundBeerActiveTeams) {
    currentGame.roundBeerActiveTeams = [];
}
let gameTimer = null;
let roundTransition = false;
let undoStack = JSON.parse(localStorage.getItem("undoStack")) || [];
let redoStack = JSON.parse(localStorage.getItem("redoStack")) || [];
const maxHistoryEntries = 20;
const pressState = {};
const doubleClickDelay = 350;
const longPressDelay = 500;
const startPattern = ["topLeft", "bottomRight", "bottomLeft", "topRight"];

const diagonalMap = {
    topLeft: "bottomRight",
    bottomRight: "topLeft",
    bottomLeft: "topRight",
    topRight: "bottomLeft"
};

const horizontalMap = {
    topLeft: "topRight",
    topRight: "topLeft",
    bottomLeft: "bottomRight",
    bottomRight: "bottomLeft"
};
let fieldPressTimer = null;
let fieldLongPress = false;
function getNextStartPosition(currentStartPosition) {
    const index = startPattern.indexOf(currentStartPosition);
    return startPattern[(index + 1) % startPattern.length];
}
function hasBeerWinner() {
    return (
        currentGame &&
        Number.isInteger(currentGame.beerWinnerTeamIndex)
    );
}
function createInitialPlayerBeers() {
    return {
        topLeft: false,
        bottomLeft: false,
        bottomRight: false,
        topRight: false
    };
}
function getTeamPositions(teamIndex) {
    return teamIndex === 0
        ? ["topLeft", "bottomLeft"]
        : ["bottomRight", "topRight"];
}

function getTeamsThatMustEx() {
    const c = currentGame.fieldCounts || {};
    const teams = [];

    if ((c["red1"] || 0) > 0) {
        teams.push(0);
    }

    if ((c["red-1"] || 0) > 0) {
        teams.push(1);
    }

    return teams;
}

function resetTeamBeersForEx(teamIndex) {
    if (!currentGame.playerBeers) {
        currentGame.playerBeers = createInitialPlayerBeers();
    }

    getTeamPositions(teamIndex).forEach(position => {
        currentGame.playerBeers[position] = false;
    });
}

function isPlayerBeerEmpty(position) {
    if (!currentGame.playerBeers) {
        currentGame.playerBeers = createInitialPlayerBeers();
    }

    return currentGame.playerBeers[position] === true;
}

function teamHasBothBeersEmpty(teamIndex) {
    if (!currentGame.playerBeers) {
        currentGame.playerBeers = createInitialPlayerBeers();
    }

    return getTeamPositions(teamIndex)
        .every(position => currentGame.playerBeers[position] === true);
}
function createInitialTeamErasers() {
    return {
        "0": false,
        "1": false
    };
}
function fieldPointerDown(event) {

    if (
        event.target.closest(".targetButton") ||
        event.target.closest(".redButton") ||
        event.target.closest(".fieldPlayer")||
        event.target.closest(".playerCapButton")
    ) {
        return;
    }

    fieldLongPress = false;

    fieldPressTimer = setTimeout(() => {
        fieldLongPress = true;
        handleTargetInput(0, true);
    }, 500);
}

function fieldPointerUp(event) {

    if (
        event.target.closest(".targetButton") ||
        event.target.closest(".redButton") ||
        event.target.closest(".fieldPlayer") ||
        event.target.closest(".playerCapButton")
    ) {
        return;
    }

    clearTimeout(fieldPressTimer);

    if (!fieldLongPress) {
        handleTargetInput(0, false);
    }
}

function fieldPointerCancel() {
    clearTimeout(fieldPressTimer);
}
function createEmptyFieldCounts() {
    return {
        "-3": 0,
        "-2": 0,
        "-1": 0,
        "0": 0,
        "1": 0,
        "2": 0,
        "3": 0,
        "red1": 0,
        "red-1": 0
    };
}
function debugLog(...args) {
    const text = args
        .map(x =>
            typeof x === "object"
                ? JSON.stringify(x)
                : String(x)
        )
        .join(" ");
    
    const lineText = `[${getGameTimestamp()}] ${text}`;
    const id = Date.now() + "_" + Math.random();
    const logs =
        JSON.parse(localStorage.getItem("debugLog"))
        || [];

    logs.push({
        id: id,
        text: lineText,
        undone: false
    });

    while (logs.length > 100000) {
        logs.shift();
    }

    localStorage.setItem(
        "debugLog",
        JSON.stringify(logs)
    );

    const div =
        document.getElementById("debugConsole");

    if (!div) return;

    const line =
        document.createElement("div");
    line.id = id;
    line.textContent = lineText;

    div.appendChild(line);

    div.scrollTop =
        div.scrollHeight;
    return id;
}
function restoreDebugLog() {
    const logs =
        JSON.parse(localStorage.getItem("debugLog")) || [];

    const div =
        document.getElementById("debugConsole");

    if (!div) return;

    const fragment =
        document.createDocumentFragment();

    logs.forEach(log => {
        const line =
            document.createElement("div");

        line.id = log.id;
        line.textContent = log.text;

        if (log.undone) {
            line.classList.add("debugUndone");
        }

        if (log.merged && !log.undone) {
            line.classList.add("debugMerged");
        }

        fragment.appendChild(line);
    });

    div.replaceChildren(fragment);
    div.scrollTop = div.scrollHeight;
}
function savePlayers() {
    localStorage.setItem("players", JSON.stringify(players));
}

function saveCurrentGame() {
    if (currentGame) {
        localStorage.setItem("currentGame", JSON.stringify(currentGame));
    } else {
        localStorage.removeItem("currentGame");
    }
}
function cloneGame(game) {
    return JSON.parse(JSON.stringify(game));
}

function saveHistory() {
    undoStack = undoStack.slice(-maxHistoryEntries);
    redoStack = redoStack.slice(-maxHistoryEntries);

    try {
        localStorage.setItem("undoStack", JSON.stringify(undoStack));
        localStorage.setItem("redoStack", JSON.stringify(redoStack));
    } catch (e) {
        undoStack = undoStack.slice(-10);
        redoStack = redoStack.slice(-10);

        localStorage.setItem("undoStack", JSON.stringify(undoStack));
        localStorage.setItem("redoStack", JSON.stringify(redoStack));

        debugLog("Undo/Redo-Historie wurde wegen vollem Speicher gekürzt.");
    }
}

function commitGameAction(actionFunction) {
    if (!currentGame) return;

    undoStack.push(cloneGame(currentGame));
    while (undoStack.length > maxHistoryEntries) {
        undoStack.shift();
    }
    redoStack = [];
    while (redoStack.length > maxHistoryEntries) {
        redoStack.shift();
    }
    actionFunction();

    saveCurrentGame();
    saveHistory();

    renderGameInfo();

    requestAnimationFrame(() => {
        updateAllFieldCountDisplays();
        updateAllPlayerCapDisplays();
        restoreDebugLog();
    });
}

function undoGameAction() {
    if (!currentGame || undoStack.length === 0) return;

    const currentBeforeUndo = cloneGame(currentGame);
    const previousGame = undoStack.pop();

    const previousLogIds = new Set(
        previousGame.events
            .filter(e => e.logId)
            .map(e => e.logId)
    );

    currentBeforeUndo.events.forEach(e => {

        if (!e.logId) return;

        if (!previousLogIds.has(e.logId)) {

            if (e.type === "field_merge") {
                deleteLog(e.logId);
            } else {
                markLogUndone(e.logId);
            }
        }
    });

    previousGame.events.forEach(e => {
        if (!e.logId) return;

        if (e.undone) {
            markLogUndone(e.logId);
        } else {
            markLogRedone(e.logId);
        }

        if (e.merged) {
            markLogMerged(e.logId);
        } else {
            unmarkLogMerged(e.logId);
        }
    });

    const removedEvents =
        currentBeforeUndo.events.filter(
            e => !previousGame.events.includes(e)
        );

    removedEvents.forEach(e => {

        if (
            e.type === "field_add" ||
            e.type === "field_remove"
        ) {

            const matchingEvent =
                previousGame.events.find(x =>
                    x.logId === e.logId
                );

            if (matchingEvent) {
                unmarkLogMerged(e.logId);
                markLogRedone(e.logId);
            }
        }
    });

    redoStack.push(currentBeforeUndo);
    limitHistoryStack(redoStack);

    currentGame = previousGame;
    syncGameTimerWithGameState();
    saveCurrentGame();
    saveHistory();

    renderGameInfo();

    requestAnimationFrame(() => {
        updateAllFieldCountDisplays();
        updateAllPlayerCapDisplays();
        restoreDebugLog();
    });
}
function getPointDrinkingTeamIndex(options = {}) {
    if (options.eraser) {
        return null;
    }

    const score = getCurrentScore();

    if (score.team1 > score.team2) {
        return 0;
    }

    if (score.team2 > score.team1) {
        return 1;
    }

    return null;
}

function getBeerActiveTeamsForCurrentRound(options = {}) {
    const teams = new Set();

    const pointTeam =
        getPointDrinkingTeamIndex(options);

    if (pointTeam !== null) {
        teams.add(pointTeam);
    }

    getTeamsThatMustEx().forEach(teamIndex => {
        teams.add(teamIndex);
    });

    return Array.from(teams);
}

function teamCanUseBeer(teamIndex) {
    if (!currentGame || !currentGame.awaitingNextRound) {
        return false;
    }

    if (!Array.isArray(currentGame.roundBeerActiveTeams)) {
        currentGame.roundBeerActiveTeams = [];
    }

    return currentGame.roundBeerActiveTeams.includes(teamIndex);
}
function limitHistoryStack(stack) {
    while (stack.length > maxHistoryEntries) {
        stack.shift();
    }
}
function deleteLog(logId) {

    let logs =
        JSON.parse(localStorage.getItem("debugLog"))
        || [];

    logs =
        logs.filter(x => x.id !== logId);

    localStorage.setItem(
        "debugLog",
        JSON.stringify(logs)
    );

    const el =
        document.getElementById(logId);

    if (el) {
        el.remove();
    }
}
function redoGameAction() {
    if (!currentGame || redoStack.length === 0) return;

    const currentBeforeRedo = cloneGame(currentGame);
    const redoneGame = redoStack.pop();

    const currentLogIds = new Set(
        currentGame.events
            .filter(e => e.logId)
            .map(e => e.logId)
    );

    redoneGame.events.forEach(e => {
        if (!e.logId) return;

        if (!currentLogIds.has(e.logId)) {
            if (e.type === "field_merge") {
                restoreDeletedLog(e.logId, e.logText);
            }

            if (e.undone) {
                markLogUndone(e.logId);
            } else {
                markLogRedone(e.logId);
            }
        } else {
            if (e.undone) {
                markLogUndone(e.logId);
            } else {
                markLogRedone(e.logId);
            }
        }

        if (e.merged) {
            markLogMerged(e.logId);
        } else {
            unmarkLogMerged(e.logId);
        }
    });

    undoStack.push(currentBeforeRedo);
    limitHistoryStack(undoStack);

    currentGame = redoneGame;
    syncGameTimerWithGameState();
    saveCurrentGame();
    saveHistory();

    renderGameInfo();

    requestAnimationFrame(() => {
        updateAllFieldCountDisplays();
        updateAllPlayerCapDisplays();
        restoreDebugLog();
    });
}
function addPlayer() {
    const input = document.getElementById("newPlayerName");
    const name = input.value.trim();

    if (name === "") {
        alert("Bitte Spielernamen eingeben.");
        return;
    }

    players.push({
        id: Date.now(),
        name: name
    });

    savePlayers();
    input.value = "";

    renderPlayerList();
    renderPlayerSelection();
}

function deletePlayer(id) {
    players = players.filter(player => player.id !== id);
    savePlayers();
    renderPlayerList();
    renderPlayerSelection();
}

function renderPlayerList() {
    let html = "";

    if (players.length === 0) {
        html = "<p>Noch keine Spieler angelegt.</p>";
    }

    players.forEach(player => {
        html += `
            <div class="playerRow">
                <span>${player.name}</span>
                <button onclick="deletePlayer(${player.id})">Löschen</button>
            </div>
        `;
    });

    document.getElementById("playerList").innerHTML = html;
}

function onModeChange() {
    const last = getLastSelection();
    last.mode = document.getElementById("mode").value;
    localStorage.setItem("lastSelection", JSON.stringify(last));
    renderPlayerSelection();
}

function renderPlayerSelection() {
    const mode = document.getElementById("mode").value;
    let html = "";

    if (players.length === 0) {
        html = "<p>Erst Spieler hinzufügen.</p>";
    }

    if (mode === "1v1") {
        html += `
            <h4>Spieler 1</h4>
            ${playerSelectHtml("p1")}

            <h4>Spieler 2</h4>
            ${playerSelectHtml("p2")}
        `;
    }

    if (mode === "2v2") {
        html += `
            <h4>Team 1</h4>
            <label>Linksschnipper</label><br>
            ${playerSelectHtml("t1p1")}

            <label>Rechtsschnipper</label><br>
            ${playerSelectHtml("t1p2")}

            <h4>Team 2</h4>
            <label>Linksschnipper</label><br>
            ${playerSelectHtml("t2p1")}

            <label>Rechtsschnipper</label><br>
            ${playerSelectHtml("t2p2")}
        `;
    }

    document.getElementById("playerSelection").innerHTML = html;
}

function getLogTextById(logId) {
    const logs = JSON.parse(localStorage.getItem("debugLog")) || [];
    const entry = logs.find(x => x.id === logId);
    return entry ? entry.text : "";
}

function restoreDeletedLog(logId, text) {
    if (!text) return;

    let logs =
        JSON.parse(localStorage.getItem("debugLog")) || [];

    if (!logs.some(x => x.id === logId)) {
        logs.push({
            id: logId,
            text: text,
            undone: false,
            merged: false
        });
    }

    localStorage.setItem("debugLog", JSON.stringify(logs));
}
function playerSelectHtml(id) {
    const last = getLastSelection();

    let html = `<select id="${id}" onchange="saveLastSelection()">`;
    html += `<option value="">Spieler wählen</option>`;

    players.forEach(player => {
        const selected =
            String(last[id]) === String(player.id)
                ? "selected"
                : "";

        html += `
            <option value="${player.id}" ${selected}>
                ${player.name}
            </option>
        `;
    });

    html += `</select><br>`;
    return html;
}

function saveLastSelection() {
    const mode = document.getElementById("mode").value;
    const old = getLastSelection();

    const selection = {
        ...old,
        mode: mode,
        p1: document.getElementById("p1")?.value || old.p1 || "",
        p2: document.getElementById("p2")?.value || old.p2 || "",
        t1p1: document.getElementById("t1p1")?.value || old.t1p1 || "",
        t1p2: document.getElementById("t1p2")?.value || old.t1p2 || "",
        t2p1: document.getElementById("t2p1")?.value || old.t2p1 || "",
        t2p2: document.getElementById("t2p2")?.value || old.t2p2 || ""
    };

    localStorage.setItem("lastSelection", JSON.stringify(selection));
}

function getLastSelection() {
    return JSON.parse(localStorage.getItem("lastSelection")) || {};
}
function createInitialPlayerCaps() {
    return {
        topLeft: 1,
        bottomLeft: 1,
        bottomRight: 1,
        topRight: 1
    };
}
function getPlayerCap(position) {
    if (!currentGame || !currentGame.playerCaps) return 0;
    return currentGame.playerCaps[position] || 0;
}

function changePlayerCap(position, delta) {
    if (!currentGame.playerCaps) {
        currentGame.playerCaps = createInitialPlayerCaps();
    }

    const oldValue = currentGame.playerCaps[position] || 0;
    currentGame.playerCaps[position] = Math.max(0, oldValue + delta);
}
function playerCapPointerDown(event, position) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    targetPointerDown(event, "cap_" + position);
}

function playerCapPointerUp(event, position) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const key = "cap_" + position;
    const state = pressState[key];

    if (!state) return;

    clearTimeout(state.longTimer);

    const isLongPress = state.longTriggered;

    if (isLongPress) {
        state.longTriggered = false;
        handlePlayerCapInput(position, true);
        return;
    }

    if (state.clickTimer) {
        clearTimeout(state.clickTimer);
        state.clickTimer = null;
        handlePlayerCapInput(position, true);
        return;
    }

    state.clickTimer = setTimeout(() => {
        state.clickTimer = null;
        handlePlayerCapInput(position, false);
    }, doubleClickDelay);
}
function getLastRoundResultEventForCurrentRound() {
    if (!currentGame || !currentGame.events) return null;

    for (let i = currentGame.events.length - 1; i >= 0; i--) {
        const event = currentGame.events[i];

        if (
            event.type === "round_result" &&
            event.round === currentGame.round
        ) {
            return event;
        }
    }

    return null;
}

function currentRoundAlreadyErased() {
    const event =
        getLastRoundResultEventForCurrentRound();

    return event && event.eraser === true;
}
function handlePlayerCapInput(position, isLongPress) {
   if (
        !currentGame ||
        currentGame.startSelectionActive ||
        currentGame.awaitingNextRound
    ) return;

    const currentPosition = getCurrentTurnPosition();
    const currentPlayer = getCurrentPlayerInfo();

    if (position === currentPosition) {
        return;
    }

    if (isLongPress && getPlayerCap(position) <= 0) {
        return;
    }

    const targetPlayerName = getPlayerNameByPosition(position);

    commitGameAction(() => {
        if (isLongPress) {
            changePlayerCap(position, -1);

            const logId = debugLog(
                `${currentPlayer.playerName} löscht Kronkorken von ${targetPlayerName}`
            );

            currentGame.events.push({
                type: "player_cap_remove",
                position: currentPosition,
                targetPosition: position,
                playerId: currentPlayer.playerId,
                teamIndex: currentPlayer.teamIndex,
                timestamp: Date.now(),
                logId: logId
            });

            return;
        }

        changePlayerCap(position, +1);
        if (!currentGame.forcedTurnQueue) {
            currentGame.forcedTurnQueue = [];
        }

        currentGame.forcedTurnQueue.push(position);
        const logId = debugLog(
            `${currentPlayer.playerName} schießt eigenen Kronkorken zu ${targetPlayerName}`
        );

        currentGame.events.push({
            type: "player_cap_move",
            from: currentPosition,
            to: position,
            position: currentPosition,
            playerId: currentPlayer.playerId,
            teamIndex: currentPlayer.teamIndex,
            timestamp: Date.now(),
            logId: logId
        });
    });
}
function getPlayerNameByPosition(position) {
    const positionToTeam = {
        topLeft: 0,
        bottomLeft: 0,
        bottomRight: 1,
        topRight: 1
    };

    const positionToPlayerIndex = {
        topLeft: 0,
        bottomLeft: 1,
        bottomRight: 0,
        topRight: 1
    };

    const teamIndex = positionToTeam[position];
    const playerIndex = positionToPlayerIndex[position];

    return getPlayerName(currentGame.teams[teamIndex][playerIndex]);
}
function getMergeStatCategoryFromEvents(addEvent, removeEvent) {
    const addValue = addEvent.fieldValue;
    const removeValue = removeEvent.fieldValue;

    let delta;
    let suffix;

    if (removeEvent.isOwn) {
        // Beispiel: eigene 3 löschen und gegnerische 2 treffen => 1erlöscher
        delta = removeValue - addValue;
        suffix = "löscher";
    } else {
        // Gegnerfeld löschen/kicken und danach verrechnen
        delta = removeValue - addValue;
        suffix = "kick";
    }

    const value = Math.abs(delta);

    if (value < 1 || value > 3) {
        return null;
    }

    return `${value}er${suffix}`;
}
function startGame() {
    
    localStorage.removeItem("debugLog");

    const debugConsole =
        document.getElementById("debugConsole");

    if (debugConsole) {
        debugConsole.innerHTML = "";
    }
    saveLastSelection();

    const mode = document.getElementById("mode").value;
    let teams = [];

    if (mode === "1v1") {
        const p1 = Number(document.getElementById("p1").value);
        const p2 = Number(document.getElementById("p2").value);

        if (!p1 || !p2) {
            alert("Für 1v1 genau 2 Spieler auswählen.");
            return;
        }

        if (p1 === p2) {
            alert("Ein Spieler kann nicht gegen sich selbst spielen.");
            return;
        }

        teams = [
            [p1, p1],
            [p2, p2]
        ];
    }

    if (mode === "2v2") {
        const t1p1 = Number(document.getElementById("t1p1").value);
        const t1p2 = Number(document.getElementById("t1p2").value);
        const t2p1 = Number(document.getElementById("t2p1").value);
        const t2p2 = Number(document.getElementById("t2p2").value);

        const selected = [t1p1, t1p2, t2p1, t2p2];

        if (selected.some(id => !id)) {
            alert("Für 2v2 genau 4 Spieler auswählen.");
            return;
        }

        if (new Set(selected).size !== 4) {
            alert("Jeder Spieler darf nur einmal ausgewählt werden.");
            return;
        }

        teams = [
            [t1p1, t1p2],
            [t2p1, t2p2]
        ];
    }

    currentGame = {
        id: Date.now(),
        mode: mode,
        teams: teams,
        startTime: new Date().toISOString(),
        endTime: null,
        round: 0,
        turnInRound: 0,
        startIndex: null,
        startSelectionActive: true,
        fieldCounts: {
            "-3": 0,
            "-2": 0,
            "-1": 0,
            "0": 0,
            "1": 0,
            "2": 0,
            "3": 0,
            "red1": 0,
            "red-1": 0
        },
        events: [],
        playerCaps: createInitialPlayerCaps(),
        forcedTurnActive: false,
        forcedTurnQueue: [],
        teamEraserUsed: createInitialTeamErasers(),
        awaitingNextRound: false,
        keepStartPlayerForNextRound: false,
        roundBeerActiveTeams: [],
        beerWinnerTeamIndex: null,
        endTime: null,
        roundBeerActiveTeams: [],
        playerBeers: createInitialPlayerBeers(),
    };
    undoStack = [];
    redoStack = [];
    saveHistory();
    saveCurrentGame();

    document.getElementById("setupSection").style.display = "none";
    document.getElementById("playerSection").style.display = "none";
    document.getElementById("currentGameSection").style.display = "block";
    renderGameInfo();
    startGameTimer();
}
function getElapsedTime() {
    if (!currentGame) return "00:00";

    const start = new Date(currentGame.startTime);
    const end = currentGame.endTime
        ? new Date(currentGame.endTime)
        : new Date();

    const diffSeconds = Math.floor((end - start) / 1000);

    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;

    if (hours > 0) {
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function syncGameTimerWithGameState() {
    if (!currentGame) {
        stopGameTimer();
        return;
    }

    if (hasBeerWinner()) {
        stopGameTimer();
        updateElapsedTimeOnly();
        return;
    }

    startGameTimer();
}
function startNextRoundAfterPause() {
    
    currentGame.awaitingNextRound = false;
    currentGame.roundTransitionUntil = null;
    currentGame.pendingRoundReset = false;

    currentGame.turnInRound = 0;
    currentGame.round++;
    currentGame.roundBeerActiveTeams = [];

    const nextStartPosition =
        currentGame.keepStartPlayerForNextRound
            ? currentGame.startPosition
            : getNextStartPosition(currentGame.startPosition);

    currentGame.keepStartPlayerForNextRound = false;

    currentGame.startPosition = nextStartPosition;
    currentGame.startIndex =
        startPattern.indexOf(nextStartPosition);

    currentGame.startOrder =
        getOrderFromStart(nextStartPosition);

    currentGame.fieldCounts = createEmptyFieldCounts();
    currentGame.playerCaps = createInitialPlayerCaps();

    currentGame.forcedTurnActive = false;
    currentGame.forcedTurnQueue = [];

    const roundLogId =
        debugLog(`Runde ${currentGame.round}`);

    currentGame.events.push({
        type: "round_start",
        round: currentGame.round,
        timestamp: Date.now(),
        logId: roundLogId
    });

    const startPlayer =
        getPlayerInfoByPosition(currentGame.startPosition);

    const turnLogId =
        debugLog(`${startPlayer.playerName} startet.`);

    currentGame.events.push({
        type: "turn_start",
        playerId: startPlayer.playerId,
        teamIndex: startPlayer.teamIndex,
        position: currentGame.startPosition,
        round: currentGame.round,
        turnInRound: currentGame.turnInRound,
        timestamp: Date.now(),
        logId: turnLogId
    });
}
function getPlayerCapDomId(position) {
    return "playerCap_" + position;
}

function updatePlayerCapDisplay(position) {
    const button =
        document.getElementById(getPlayerCapDomId(position));

    if (!button) return;

    const text =
        button.querySelector(".playerCapText");

    if (text) {
        text.textContent = getPlayerCap(position);
    }
}

function updateAllPlayerCapDisplays() {
    ["topLeft", "bottomLeft", "bottomRight", "topRight"]
        .forEach(updatePlayerCapDisplay);
}
function getPlayerInfoByPosition(position) {
    const positionToTeam = {
        topLeft: 0,
        bottomLeft: 0,
        bottomRight: 1,
        topRight: 1
    };

    const positionToPlayerIndex = {
        topLeft: 0,
        bottomLeft: 1,
        bottomRight: 0,
        topRight: 1
    };

    const teamIndex = positionToTeam[position];
    const playerIndex = positionToPlayerIndex[position];

    const playerId = currentGame.teams[teamIndex][playerIndex];

    return {
        playerId,
        playerName: getPlayerName(playerId),
        teamIndex,
        teamName: `Team ${teamIndex + 1}`,
        position
    };
}
function nextTurn() {
    if (!currentGame) return;
    if (hasBeerWinner()) {
        return;
    }
    if (currentGame.startSelectionActive) {
        alert("Bitte zuerst Startspieler wählen.");
        return;
    }

    if (currentGame.awaitingNextRound) {
        commitGameAction(() => {
            startNextRoundAfterPause();
        });

        return;
    }

    if (
        currentGame.roundTransitionUntil &&
        Date.now() < currentGame.roundTransitionUntil
    ) {
        return;
    }

    commitGameAction(() => {
        if (!currentGame.forcedTurnQueue) {
            currentGame.forcedTurnQueue = [];
        }

        const wasForcedTurn = currentGame.forcedTurnActive;

        const finishedPosition = wasForcedTurn
            ? currentGame.forcedTurnQueue[0]
            : getCurrentTurnPosition();

        if (finishedPosition) {
            changePlayerCap(finishedPosition, -1);
        }

        if (wasForcedTurn) {
            currentGame.forcedTurnQueue.shift();
            activateNextForcedTurnOrStop();
        } else {
            currentGame.turnInRound++;
            activateNextForcedTurnOrStop();
        }

        if (
            currentGame.turnInRound >= 4 &&
            !currentGame.forcedTurnActive &&
            currentGame.forcedTurnQueue.length === 0
        ) {
            finishRound({
                eraser: false,
                keepStartPlayer: false
            });

            return;
        }

        let nextPosition = getActiveTurnPosition();

        while (
            nextPosition &&
            !currentGame.forcedTurnActive &&
            currentGame.turnInRound < 4 &&
            getPlayerCap(nextPosition) <= 0
        ) {
            const skippedPlayer =
                getPlayerInfoByPosition(nextPosition);

            const noCapLogId = debugLog(
                `${skippedPlayer.playerName} hat keinen Kronkorken zum Schießen.`
            );

            currentGame.events.push({
                type: "player_no_cap",
                playerId: skippedPlayer.playerId,
                teamIndex: skippedPlayer.teamIndex,
                position: nextPosition,
                round: currentGame.round,
                turnInRound: currentGame.turnInRound,
                timestamp: Date.now(),
                logId: noCapLogId
            });

            currentGame.turnInRound++;

            if (
                currentGame.turnInRound >= 4 &&
                !currentGame.forcedTurnActive &&
                (!currentGame.forcedTurnQueue || currentGame.forcedTurnQueue.length === 0)
            ) {
                finishRound({
                    eraser: false,
                    keepStartPlayer: false
                });

                return;
            }

            nextPosition = getCurrentTurnPosition();
        }

        nextPosition = getActiveTurnPosition();

        if (!nextPosition) {
            return;
        }

        const nextPlayer =
            getPlayerInfoByPosition(nextPosition);

        const turnMessage =
            currentGame.forcedTurnActive
                ? `Sonderzug: ${nextPlayer.playerName} ist dran.`
                : currentGame.turnInRound === 0
                    ? `${nextPlayer.playerName} startet.`
                    : `${nextPlayer.playerName} ist dran.`;

        const turnLogId =
            debugLog(turnMessage);

        currentGame.events.push({
            type: "turn_start",
            playerId: nextPlayer.playerId,
            teamIndex: nextPlayer.teamIndex,
            position: nextPosition,
            round: currentGame.round,
            turnInRound: currentGame.turnInRound,
            forcedTurn: currentGame.forcedTurnActive,
            timestamp: Date.now(),
            logId: turnLogId
        });
    });
}
function getOrderFromStart(start) {
    const second = diagonalMap[start];
    const third = horizontalMap[second];
    const fourth = diagonalMap[third];

    return [start, second, third, fourth];
}
function getRoundOrder() {
    if (!currentGame || !currentGame.startOrder) {
        return [];
    }

    return currentGame.startOrder;
}
function selectStartPlayer(position) {
    if (!currentGame || !currentGame.startSelectionActive) return;

    currentGame.startOrder = getOrderFromStart(position);
    currentGame.startPosition = position;
    currentGame.startIndex = startPattern.indexOf(position);

    currentGame.round = 1;
    currentGame.turnInRound = 0;
    currentGame.startSelectionActive = false;
    currentGame.roundTransitionUntil = null;

    const roundLogId = debugLog(`Runde ${currentGame.round}`);

    currentGame.events.push({
        type: "round_start",
        round: currentGame.round,
        timestamp: Date.now(),
        logId: roundLogId
    });

    const currentPlayer = getCurrentPlayerInfo();
    const turnLogId = debugLog(`${currentPlayer.playerName} startet.`);

    currentGame.events.push({
        type: "turn_start",
        playerId: currentPlayer.playerId,
        teamIndex: currentPlayer.teamIndex,
        round: currentGame.round,
        turnInRound: currentGame.turnInRound,
        timestamp: Date.now(),
        logId: turnLogId
    });

    saveCurrentGame();
    renderGameInfo();
    restoreDebugLog();
}
function getCurrentTurnPosition() {
    if (!currentGame) return null;
    if (currentGame.startSelectionActive) return null;

    return currentGame.startOrder[currentGame.turnInRound] || null;
}
function getActiveTurnPosition() {
    if (!currentGame) return null;
    if (currentGame.startSelectionActive) return null;

    if (
        currentGame.forcedTurnActive &&
        currentGame.forcedTurnQueue &&
        currentGame.forcedTurnQueue.length > 0
    ) {
        return currentGame.forcedTurnQueue[0];
    }

    return getCurrentTurnPosition();
}
function renderTeamEraserButtons() {
    if (!currentGame || currentGame.startSelectionActive) {
        return "";
    }

    if (!currentGame.teamEraserUsed) {
        currentGame.teamEraserUsed = createInitialTeamErasers();
    }

    const inPause =
        currentGame.awaitingNextRound === true;

    const alreadyErased =
        inPause && currentRoundAlreadyErased();

    const team1Used = currentGame.teamEraserUsed["0"];
    const team2Used = currentGame.teamEraserUsed["1"];

    const team1Disabled =
        !inPause || team1Used || alreadyErased;

    const team2Disabled =
        !inPause || team2Used || alreadyErased;

    return `
        <div class="teamEraserRow">
            <button
                class="teamEraserButton
                    ${team1Used ? "teamEraserUsed" : ""}
                    ${!inPause && !team1Used ? "teamEraserInactive" : ""}
                    ${alreadyErased && !team1Used ? "teamEraserLocked" : ""}"
                onclick="useTeamEraser(0)"
                ${team1Disabled ? "disabled" : ""}>
                Team 1<br>Löscher
            </button>

            <button
                class="teamEraserButton
                    ${team2Used ? "teamEraserUsed" : ""}
                    ${!inPause && !team2Used ? "teamEraserInactive" : ""}
                    ${alreadyErased && !team2Used ? "teamEraserLocked" : ""}"
                onclick="useTeamEraser(1)"
                ${team2Disabled ? "disabled" : ""}>
                Team 2<br>Löscher
            </button>
        </div>
    `;
}
function endGame() {
    if (!currentGame) {
        alert("Kein aktives Spiel.");
        return;
    }

    currentGame.endTime = new Date().toISOString();

    let games = JSON.parse(localStorage.getItem("games")) || [];
    games.push(currentGame);

    localStorage.setItem("games", JSON.stringify(games));

    currentGame = null;
    undoStack = [];
    redoStack = [];
    saveHistory();

    document.getElementById("currentGameSection").style.display = "none";
    saveCurrentGame();

    stopGameTimer();

    document.getElementById("setupSection").style.display = "block";
    document.getElementById("playerSection").style.display = "block";

    renderGameInfo();

    alert("Spiel gespeichert.");
}
const statCategories = [
    "0",
    "1",
    "2",
    "3",
    "rot",
    "-1",
    "-2",
    "-3",
    "-rot",
    "1erlöscher",
    "2erlöscher",
    "3erlöscher",
    "rotlöscher",
    "1erkick",
    "2erkick",
    "3erkick",
    "rotkick",
    "gegnerkorkenlöscher",
    "korkenschenker"
];

function createEmptyPlayerStats() {
    const stats = {};

    statCategories.forEach(category => {
        stats[category] = 0;
    });

    return stats;
}

function getPlayerSideByPosition(position) {
    if (position === "topLeft" || position === "bottomLeft") {
        return "links";
    }

    if (position === "topRight" || position === "bottomRight") {
        return "rechts";
    }

    return "";
}

function getPlayerPositionByEvent(event) {
    if (event.position) {
        return event.position;
    }

    if (event.type === "player_cap_move" && event.from) {
        return event.from;
    }

    if (event.type === "player_cap_remove" && event.playerPosition) {
        return event.playerPosition;
    }

    const team = currentGame.teams[event.teamIndex] || [];
    const playerIndex = team.indexOf(event.playerId);

    if (event.teamIndex === 0) {
        return playerIndex === 1 ? "bottomLeft" : "topLeft";
    }

    if (event.teamIndex === 1) {
        return playerIndex === 1 ? "topRight" : "bottomRight";
    }

    return null;
}

function getStatPlayerLabelByEvent(event) {
    const position = getPlayerPositionByEvent(event);

    if (!position) {
        return "Unbekannt";
    }

    const player =
        getPlayerInfoByPosition(position);

    return player.playerName;
}
function getHitStatCategory(value) {
    if (value === 0) return "0";

    if (value === "red1") return "-rot";
    if (value === "red-1") return "rot";

    const numericValue = Number(value);

    if (numericValue > 0) {
        return `-${numericValue}`;
    }

    if (numericValue < 0) {
        return String(Math.abs(numericValue));
    }

    return null;
}

function getRemoveStatCategory(value, isOwn) {
    if (value === "red1" || value === "red-1") {
        return isOwn ? "rotlöscher" : "rotkick";
    }

    const fieldValue = getFieldAbsValue(value);

    if (fieldValue <= 0) {
        return null;
    }

    return `${fieldValue}er${isOwn ? "löscher" : "kick"}`;
}

function getMergeStatCategory(mergeEvent) {
    if (mergeEvent.statCategory) {
        return mergeEvent.statCategory;
    }

    const delta =
        Math.abs(mergeEvent.removeValue) -
        Math.abs(mergeEvent.addValue);

    if (delta === 0) {
        return null;
    }

    const value = Math.abs(delta);

    if (value < 1 || value > 3) {
        return null;
    }

    const suffix =
        mergeEvent.removeIsOwn !== undefined
            ? mergeEvent.removeIsOwn
                ? "löscher"
                : "kick"
            : mergeEvent.isOwn
                ? "löscher"
                : "kick";

    return `${value}er${suffix}`;
}

function addStat(statsByPlayer, playerLabel, category, amount = 1) {
    if (!category) return;

    if (!statsByPlayer[playerLabel]) {
        statsByPlayer[playerLabel] = createEmptyPlayerStats();
    }

    if (statsByPlayer[playerLabel][category] === undefined) {
        statsByPlayer[playerLabel][category] = 0;
    }

    statsByPlayer[playerLabel][category] += amount;
}
function getPlayerStats() {
    const statsByPlayer = {};

    if (!currentGame || !currentGame.events) {
        return statsByPlayer;
    }

    ["topLeft", "bottomLeft", "bottomRight", "topRight"]
    .forEach(position => {
        const player =
            getPlayerInfoByPosition(position);

        const label =
            player.playerName;

        if (!statsByPlayer[label]) {
            statsByPlayer[label] = createEmptyPlayerStats();
        }
    });

    currentGame.events.forEach(event => {
        const playerLabel =
            getStatPlayerLabelByEvent(event);

        if (event.type === "field_add") {
            if (event.merged) return;

            addStat(
                statsByPlayer,
                playerLabel,
                getHitStatCategory(event.value)
            );
        }

        if (event.type === "field_remove") {
            if (event.merged) return;

            addStat(
                statsByPlayer,
                playerLabel,
                getRemoveStatCategory(event.value, event.isOwn)
            );
        }

        if (event.type === "field_merge") {
            addStat(
                statsByPlayer,
                playerLabel,
                event.statCategory
            );
        }

        if (event.type === "player_cap_remove") {
            addStat(
                statsByPlayer,
                playerLabel,
                "gegnerkorkenlöscher"
            );
        }

        if (event.type === "player_cap_move") {
            addStat(
                statsByPlayer,
                playerLabel,
                "korkenschenker"
            );
        }
    });

    return statsByPlayer;
}
function renderPlayerStatsTable() {
    const statsByPlayer = getPlayerStats();
    const playerLabels = Object.keys(statsByPlayer);

    if (playerLabels.length === 0) {
        return "";
    }

    let html = `
        <div class="playerStatsWrapper">
            <h3>Spielerstatistik</h3>
            <div class="playerStatsScroll">
                <table class="playerStatsTable">
                    <thead>
                        <tr>
                            <th>Kategorie</th>
                            ${playerLabels.map(playerLabel => `<th>${playerLabel}</th>`).join("")}
                        </tr>
                    </thead>
                    <tbody>
    `;

    statCategories.forEach(category => {
        html += `
            <tr>
                <td>${category}</td>
                ${playerLabels.map(playerLabel => {
                    const value = statsByPlayer[playerLabel][category] || 0;
                    return `<td>${value === 0 ? "" : value}</td>`;
                }).join("")}
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    return html;
}
function renderGameInfo() {
    const gameInfo = document.getElementById("gameInfo");
    if (!currentGame) {
        gameInfo.innerHTML = "";
        restoreDebugLog();
        return;
    }
    let roundInfo = "";
    if (1 === 1) {
        roundInfo =
            `<h2 style="text-align:center;">
            Runde ${currentGame.round}
        </h2>`;
    }
    const nextButtonText =
        currentGame.awaitingNextRound
            ? "Nächste Runde"
            : "Weiter";



    const team1 = currentGame.teams[0].map(getPlayerName).join(" + ");
    const team2 = currentGame.teams[1].map(getPlayerName).join(" + ");

    const isRoundTransition =
        currentGame.roundTransitionUntil &&
        Date.now() < currentGame.roundTransitionUntil;
    const currentTurn =
        isRoundTransition || currentGame.awaitingNextRound
            ? null
            : getActiveTurnPosition();


    const t1Left = getPlayerName(currentGame.teams[0][0]);
    const t1Right = getPlayerName(currentGame.teams[0][1]);
    const t2Left = getPlayerName(currentGame.teams[1][0]);
    const t2Right = getPlayerName(currentGame.teams[1][1]);
    const startMode = currentGame.startSelectionActive;
    const pauseMode = currentGame.awaitingNextRound === true;
    const winnerText =
    hasBeerWinner()
        ? `<h2 style="text-align:center;">Team ${currentGame.beerWinnerTeamIndex + 1} hat gewonnen.</h2>`
        : "";
    const fieldHtml = `
    <div class="gameField ${startMode ? "startSelectField" : ""} ${pauseMode ? "roundPauseField" : ""}"
    onpointerdown="targetPointerDown(event, 0)"
    onpointerup="targetPointerUp(event, 0)"
    onpointercancel="targetPointerCancel(0)"
    onpointerleave="targetPointerCancel(0)">
        <div
            class="fieldPlayer topLeft ${currentTurn === "topLeft" ? "activePlayer" : ""} ${startMode ? "startSelectable" : ""}"
            onclick="${startMode ? "selectStartPlayer('topLeft')" : ""}" onpointerdown="event.stopPropagation()" onpointerup="event.stopPropagation()">
            ${t1Left}
        </div>

        <div
            class="fieldPlayer bottomLeft ${currentTurn === "bottomLeft" ? "activePlayer" : ""} ${startMode ? "startSelectable" : ""}"
            onclick="${startMode ? "selectStartPlayer('bottomLeft')" : ""}" onpointerdown="event.stopPropagation()" onpointerup="event.stopPropagation()">
            ${t1Right}
        </div>

        <div
            class="fieldPlayer bottomRight ${currentTurn === "bottomRight" ? "activePlayer" : ""} ${startMode ? "startSelectable" : ""}"
            onclick="${startMode ? "selectStartPlayer('bottomRight')" : ""}" onpointerdown="event.stopPropagation()" onpointerup="event.stopPropagation()">
            ${t2Left}
        </div>

        <div
            class="fieldPlayer topRight ${currentTurn === "topRight" ? "activePlayer" : ""} ${startMode ? "startSelectable" : ""}"
            onclick="${startMode ? "selectStartPlayer('topRight')" : ""}" onpointerdown="event.stopPropagation()" onpointerup="event.stopPropagation()">
            ${t2Right}
        </div>
        ${renderPlayerBeerButton("topLeft")}
        ${renderPlayerBeerButton("bottomLeft")}
        ${renderPlayerBeerButton("bottomRight")}
        ${renderPlayerBeerButton("topRight")}
        <button class="playerCapButton playerCapTopLeft"
            id="${getPlayerCapDomId("topLeft")}"
            onpointerdown="playerCapPointerDown(event, 'topLeft')"
            onpointerup="playerCapPointerUp(event, 'topLeft')"
            onpointercancel="targetPointerCancel('cap_topLeft')"
            onpointerleave="targetPointerCancel('cap_topLeft')">
            <span class="playerCapText">${getPlayerCap("topLeft")}</span>   
        </button>

        <button class="playerCapButton playerCapBottomLeft"
        id="${getPlayerCapDomId("bottomLeft")}"
            onpointerdown="playerCapPointerDown(event, 'bottomLeft')"
            onpointerup="playerCapPointerUp(event, 'bottomLeft')"
            onpointercancel="targetPointerCancel('cap_bottomLeft')"
            onpointerleave="targetPointerCancel('cap_bottomLeft')">
            <span class="playerCapText">${getPlayerCap("bottomLeft")}</span>
        </button>

        <button class="playerCapButton playerCapTopRight"
            id="${getPlayerCapDomId("topRight")}"
            onpointerdown="playerCapPointerDown(event, 'topRight')"
            onpointerup="playerCapPointerUp(event, 'topRight')"
            onpointercancel="targetPointerCancel('cap_topRight')"
            onpointerleave="targetPointerCancel('cap_topRight')">
            <span class="playerCapText">${getPlayerCap("topRight")}</span>
        </button>

        <button class="playerCapButton playerCapBottomRight"
            id="${getPlayerCapDomId("bottomRight")}"
            onpointerdown="playerCapPointerDown(event, 'bottomRight')"
            onpointerup="playerCapPointerUp(event, 'bottomRight')"
            onpointercancel="targetPointerCancel('cap_bottomRight')"
            onpointerleave="targetPointerCancel('cap_bottomRight')">
            <span class="playerCapText">${getPlayerCap("bottomRight")}</span>
        </button>
        <div class="sideTargets leftTargets">
            <button class="targetButton target3" id="${getFieldDomId(3)}" onpointerdown="targetPointerDown(event, 3)" onpointerup="targetPointerUp(event, 3)" onpointercancel="targetPointerCancel(3)" onpointerleave="targetPointerCancel(3)">${getFieldCount(3)}</button>
            <button class="targetButton target2" id="${getFieldDomId(2)}" onpointerdown="targetPointerDown(event, 2)" onpointerup="targetPointerUp(event, 2)" onpointercancel="targetPointerCancel(2)" onpointerleave="targetPointerCancel(2)">${getFieldCount(2)}</button>
            <button class="targetButton target1" id="${getFieldDomId(1)}" onpointerdown="targetPointerDown(event, 1)" onpointerup="targetPointerUp(event, 1)" onpointercancel="targetPointerCancel(1)" onpointerleave="targetPointerCancel(1)">${getFieldCount(1)}</button>
        </div>
        <div class="redTargets leftredTargets">
            <button class="redButton" id="${getFieldDomId('red1')}" onpointerdown="targetPointerDown(event, 'red1')" onpointerup="targetPointerUp(event, 'red1')" onpointercancel="targetPointerCancel('red1')" onpointerleave="targetPointerCancel('red1')">
                ${getFieldCount("red1")}
            </button>
        </div>

        <div class="redTargets rightredTargets">
            <button class="redButton" id="${getFieldDomId('red-1')}" onpointerdown="targetPointerDown(event, 'red-1')" onpointerup="targetPointerUp(event, 'red-1')" onpointercancel="targetPointerCancel('red-1')" onpointerleave="targetPointerCancel('red-1')">
                ${getFieldCount("red-1")}
            </button>
        </div>

        <div class="sideTargets rightTargets">
            <button class="targetButton target1" id="${getFieldDomId(-1)}" onpointerdown="targetPointerDown(event, -1)" onpointerup="targetPointerUp(event, -1)" onpointercancel="targetPointerCancel(-1)" onpointerleave="targetPointerCancel(-1)">${getFieldCount(-1)}</button>
            <button class="targetButton target2" id="${getFieldDomId(-2)}" onpointerdown="targetPointerDown(event, -2)" onpointerup="targetPointerUp(event, -2)" onpointercancel="targetPointerCancel(-2)" onpointerleave="targetPointerCancel(-2)">${getFieldCount(-2)}</button>
            <button class="targetButton target3" id="${getFieldDomId(-3)}" onpointerdown="targetPointerDown(event, -3)" onpointerup="targetPointerUp(event, -3)" onpointercancel="targetPointerCancel(-3)" onpointerleave="targetPointerCancel(-3)">${getFieldCount(-3)}</button>
        </div>
    </div>
`;

    gameInfo.innerHTML = `
        <b>Aktives Spiel</b><br>
        Modus: ${currentGame.mode}<br>
        Team 1: ${team1}<br>
        Team 2: ${team2}<br>
        ${startMode ? "<h2>Startspieler wählen</h2>" : `Runde: ${currentGame.round}<br>Zug: ${currentGame.turnInRound + 1} / 4<br>`}
        Start: ${new Date(currentGame.startTime).toLocaleString()}<br>
        Laufzeit: <span id="elapsedTime">${getElapsedTime()}</span><br><br>

        <button onclick="nextTurn()">${nextButtonText}</button>
       <button onclick="undoGameAction()" ${undoStack.length === 0 ? "disabled" : ""}>
    Undo
</button>

<button onclick="redoGameAction()" ${redoStack.length === 0 ? "disabled" : ""}>
    Redo
</button>
<div id="debugConsole"></div>


        ${roundInfo}
        <div style="text-align:center;">
            ${getScoreDisplay()}
        </div>
        ${winnerText}
        ${renderTeamEraserButtons()}
        ${fieldHtml}
        ${renderPlayerStatsTable()}
        <button onclick="endGame()">Spiel beenden</button>
    `;
}
function getPlayerName(id) {
    const player = players.find(p => p.id === id);
    return player ? player.name : "Unbekannt";
}

function startGameTimer() {
    stopGameTimer();

    gameTimer = setInterval(() => {
        updateElapsedTimeOnly();
    }, 1000);
}

function stopGameTimer() {
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }
}
function updateElapsedTimeOnly() {
    const el = document.getElementById("elapsedTime");
    if (el && currentGame) {
        el.textContent = getElapsedTime();
    }
}
function getElapsedTime() {
    if (!currentGame) return "00:00";

    const start = new Date(currentGame.startTime);
    const now = new Date();

    const diffSeconds = Math.floor((now - start) / 1000);

    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;

    if (hours > 0) {
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}


function getPressKey(value) {
    return String(value);
}

function targetPointerDown(event, value) {
    if (
        currentGame &&
        (currentGame.startSelectionActive || currentGame.awaitingNextRound)
    ) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();

    const key = getPressKey(value);

    if (!pressState[key]) {
        pressState[key] = {
            longTimer: null,
            clickTimer: null,
            longTriggered: false
        };
    }

    const state = pressState[key];

    state.longTriggered = false;
    clearTimeout(state.longTimer);

    state.longTimer = setTimeout(() => {
        state.longTriggered = true;

        if (state.clickTimer) {
            clearTimeout(state.clickTimer);
            state.clickTimer = null;
        }

        handleTargetInput(value, true);
    }, longPressDelay);
}

function targetPointerUp(event, value) {
    if (
        currentGame &&
        (currentGame.startSelectionActive || currentGame.awaitingNextRound)
    ) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();

    const key = getPressKey(value);
    const state = pressState[key];

    if (!state) return;

    clearTimeout(state.longTimer);

    if (state.longTriggered) {
        state.longTriggered = false;
        return;
    }

    if (state.clickTimer) {
        clearTimeout(state.clickTimer);
        state.clickTimer = null;

        handleTargetInput(value, true);
        return;
    }

    state.clickTimer = setTimeout(() => {
        state.clickTimer = null;
        handleTargetInput(value, false);
    }, doubleClickDelay);
}

function targetPointerCancel(value) {
    const key = getPressKey(value);
    const state = pressState[key];

    if (!state) return;

    clearTimeout(state.longTimer);
    state.longTriggered = false;
}

function handleTargetInput(value, isLongPress) {
    if (!currentGame || currentGame.startSelectionActive) return;

    if (!currentGame.fieldCounts) {
        currentGame.fieldCounts = {};
    }

    const key = getFieldKey(value);

    if (currentGame.fieldCounts[key] === undefined) {
        currentGame.fieldCounts[key] = 0;
    }

    const player = getCurrentPlayerInfo();
    const fieldValue = getFieldAbsValue(value);
    const isOwn = isOwnFieldForTeam(value, player.teamIndex);
    if (value === 0 && isLongPress) {
        isLongPress = false;
    }
    if (!isLongPress) {
        commitGameAction(() => {
            currentGame.fieldCounts[key]++;
            
            const scoreText = isOwn
                ? `-${fieldValue}`
                : `+${fieldValue}`;
            
            let message;

            if (value === "red1" || value === "red-1") {

                if (isOwn) {
                    message =
                        `${player.playerName} aus ${player.teamName} trifft eigenen roten (-1 rot)`;
                } else {
                    message =
                        `${player.playerName} aus ${player.teamName} trifft gegnerischen roten (+1 rot)`;
                }

            } else if (fieldValue === 0) {

                message =
                    `${player.playerName} aus ${player.teamName} trifft nischt (0)`;

            } else if (isOwn) {

                message =
                    `${player.playerName} aus ${player.teamName} trifft eigene ${fieldValue} (-${fieldValue})`;

            } else {

                message =
                    `${player.playerName} aus ${player.teamName} trifft gegnerische ${fieldValue} (+${fieldValue})`;
            }

            const logId = debugLog(message);

            currentGame.events.push({
                type: "field_add",
                value: value,
                fieldValue: fieldValue,
                isOwn: isOwn,
                playerId: player.playerId,
                teamIndex: player.teamIndex,
                timestamp: Date.now(),
                logId: logId,
                turnKey: getTurnKey(),
                merged: false,
                position: player.position,
            });
            checkTurnMergeRule();
        });

        return;
    }

    if (currentGame.fieldCounts[key] <= 0) {

        return;
    }

    commitGameAction(() => {
        currentGame.fieldCounts[key]--;
        
        const scoreText = isOwn
            ? `+${fieldValue}`
            : `-${fieldValue}`;

        let message;

        if (value === "red1" || value === "red-1") {

            if (isOwn) {
                message =
                    `${player.playerName} aus ${player.teamName} löscht Korken auf eigenem roten (+1 rot)`;
            } else {
                message =
                    `${player.playerName} aus ${player.teamName} löscht Korken auf gegnerischem roten (-1 rot)`;
            }

        } else if (fieldValue === 0) {

            message =
                `${player.playerName} aus ${player.teamName} löscht Korken auf Mitte (0)`;

        } else if (isOwn) {

            message =
                `${player.playerName} aus ${player.teamName} löscht Korken auf eigener ${fieldValue} (+${fieldValue})`;

        } else {

            message =
                `${player.playerName} aus ${player.teamName} löscht Korken auf gegnerischer ${fieldValue} (-${fieldValue})`;
        }

        const logId = debugLog(message);

        currentGame.events.push({
            type: "field_remove",
            value: value,
            fieldValue: fieldValue,
            isOwn: isOwn,
            playerId: player.playerId,
            teamIndex: player.teamIndex,
            timestamp: Date.now(),
            logId: logId,
            turnKey: getTurnKey(),
            merged: false,
            position: player.position,
        });
        checkTurnMergeRule();
    });
}
const last = getLastSelection();
function getGameTimestamp() {

    if (!currentGame) {
        return "00:00";
    }

    const start = new Date(currentGame.startTime);

    let diffSeconds =
        Math.floor(
            (Date.now() - start.getTime()) / 1000
        );

    const days =
        Math.floor(diffSeconds / 86400);

    diffSeconds %= 86400;

    const hours =
        Math.floor(diffSeconds / 3600);

    diffSeconds %= 3600;

    const minutes =
        Math.floor(diffSeconds / 60);

    const seconds =
        diffSeconds % 60;

    if (days > 0) {
        return `${days}:${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
function getFieldKey(value) {
    return String(value);
}

function getFieldCount(value) {
    if (!currentGame || !currentGame.fieldCounts) return 0;

    const key = getFieldKey(value);
    return currentGame.fieldCounts[key] || 0;
}

function getCurrentPlayerInfo() {
    const position = getActiveTurnPosition();

    const positionToTeam = {
        topLeft: 0,
        bottomLeft: 0,
        bottomRight: 1,
        topRight: 1
    };

    const positionToPlayerIndex = {
        topLeft: 0,
        bottomLeft: 1,
        bottomRight: 0,
        topRight: 1
    };

    const teamIndex = positionToTeam[position];
    const playerIndex = positionToPlayerIndex[position];

    const playerId = currentGame.teams[teamIndex][playerIndex];

    return {
        playerId: playerId,
        playerName: getPlayerName(playerId),
        teamIndex: teamIndex,
        teamName: `Team ${teamIndex + 1}`,
        position: position
    };
}

function isOwnFieldForTeam(value, teamIndex) {

    if (value === 0) {
        return null;
    }

    if (value === "red1") {
        return teamIndex === 0;
    }

    if (value === "red-1") {
        return teamIndex === 1;
    }

    const numericValue = Number(value);

    if (teamIndex === 0) {
        return numericValue > 0;
    }

    return numericValue < 0;
}

function getFieldAbsValue(value) {

    if (value === 0) {
        return 0;
    }

    if (
        value === "red1" ||
        value === "red-1"
    ) {
        return 1;
    }

    return Math.abs(Number(value));
}

function markLogUndone(logId) {

    let logs =
        JSON.parse(localStorage.getItem("debugLog"))
        || [];

    const entry =
        logs.find(x => x.id === logId);

    if (entry) {
        entry.undone = true;
    }

    localStorage.setItem(
        "debugLog",
        JSON.stringify(logs)
    );

    const el =
        document.getElementById(logId);

    if (el) {
        el.classList.add("debugUndone");
        el.classList.remove("debugMerged");
    }
}
function markLogRedone(logId) {
    let logs =
        JSON.parse(localStorage.getItem("debugLog"))
        || [];

    const entry =
        logs.find(x => x.id === logId);

    if (entry) {
        entry.undone = false;
    }

    localStorage.setItem(
        "debugLog",
        JSON.stringify(logs)
    );

    const el =
        document.getElementById(logId);

    if (el) {
        el.classList.remove("debugUndone");
    }
}
function getCurrentScore() {
    if (!currentGame || !currentGame.fieldCounts) {
        return {
            team1: 0,
            team2: 0,
            team1OwnRed: false,
            team1EnemyRed: false,
            team2OwnRed: false,
            team2EnemyRed: false
        };
    }

    const c = currentGame.fieldCounts;

    const leftScore =
        (c["1"] || 0) * 1 +
        (c["2"] || 0) * 2 +
        (c["3"] || 0) * 3;

    const rightScore =
        (c["-1"] || 0) * 1 +
        (c["-2"] || 0) * 2 +
        (c["-3"] || 0) * 3;

    return {
        team1: rightScore,
        team2: leftScore,

        team1OwnRed: false,
        team1EnemyRed: false,

        team2OwnRed: (c["red1"] || 0) > 0,
        team2EnemyRed: (c["red-1"] || 0) > 0
    };
}

function formatTeamScore(points, ownRed) {

    if (ownRed) {
        return `${points}+rot`;
    }

    return String(points);
}
function getRoundResultMessage(roundNumber, options = {}) {
    const score = getCurrentScore();
    const c = currentGame.fieldCounts;

    const team1Points = score.team1;
    const team2Points = score.team2;

    const diff = Math.abs(team1Points - team2Points);

    const winningTeam =
        team1Points > team2Points
            ? 1
            : team2Points > team1Points
                ? 2
                : 0;

    const team1OwnRed = (c["red1"] || 0) > 0;
    const team2OwnRed = (c["red-1"] || 0) > 0;

    let parts = [`Ende Runde ${roundNumber}:`];

    if (team1OwnRed && team2OwnRed) {
        parts.push("Beide Teams müssen ihre Biere exen.");
    } else if (team1OwnRed) {
        parts.push("Team 1 müssen ihre Biere exen.");
    } else if (team2OwnRed) {
        parts.push("Team 2 müssen ihre Biere exen.");
    }

    if (options.eraser) {
        parts.push("Löscher");
        return parts.join(" ");
    }

    parts.push(
        winningTeam === 0
            ? "Nullerrunde."
            : `Team ${winningTeam} darf ${diff === 1 ? "einen Schluck" : diff + " Schlücke"} trinken.`
    );

    return parts.join(" ");
}
function finishRound(options = {}) {
    const finishedRound = currentGame.round;

    currentGame.forcedTurnActive = false;
    currentGame.forcedTurnQueue = [];

    const roundResultMessage =
        getRoundResultMessage(finishedRound, {
            eraser: options.eraser === true
        });

    const resultLogId =
        debugLog(roundResultMessage);

    currentGame.events.push({
        type: "round_result",
        round: finishedRound,
        eraser: options.eraser === true,
        eraserTeamIndex: options.eraserTeamIndex,
        timestamp: Date.now(),
        logId: resultLogId
    });
    
    currentGame.roundBeerActiveTeams =
        getBeerActiveTeamsForCurrentRound({
            eraser: options.eraser === true
        });

    getTeamsThatMustEx().forEach(teamIndex => {
        resetTeamBeersForEx(teamIndex);
    });
    currentGame.awaitingNextRound = true;
    currentGame.keepStartPlayerForNextRound =
        options.keepStartPlayer === true;
}
function usePlayerBeer(position) {
    if (!currentGame) return;
    if (currentGame.startSelectionActive) return;

    if (!currentGame.awaitingNextRound) {
        return;
    }

    if (hasBeerWinner()) {
        return;
    }

    if (!currentGame.playerBeers) {
        currentGame.playerBeers = createInitialPlayerBeers();
    }

    if (currentGame.playerBeers[position]) {
        return;
    }

    const player =
        getPlayerInfoByPosition(position);

    if (!teamCanUseBeer(player.teamIndex)) {
        return;
    }

    commitGameAction(() => {
        currentGame.playerBeers[position] = true;

        const beerLogId =
            debugLog(`${player.playerName} hat sein Bier leer.`);

        currentGame.events.push({
            type: "player_beer_empty",
            playerId: player.playerId,
            teamIndex: player.teamIndex,
            position: position,
            round: currentGame.round,
            timestamp: Date.now(),
            logId: beerLogId
        });

        if (teamHasBothBeersEmpty(player.teamIndex)) {
            currentGame.beerWinnerTeamIndex = player.teamIndex;
            currentGame.endTime = new Date().toISOString();

            const winLogId =
                debugLog(`Team ${player.teamIndex + 1} hat gewonnen.`);

            currentGame.events.push({
                type: "team_win",
                teamIndex: player.teamIndex,
                round: currentGame.round,
                timestamp: Date.now(),
                logId: winLogId
            });

            stopGameTimer();
        }
    });
}
function renderPlayerBeerButton(position) {
    if (!currentGame || currentGame.startSelectionActive) {
        return "";
    }

    if (!currentGame.playerBeers) {
        currentGame.playerBeers = createInitialPlayerBeers();
    }

    const player =
        getPlayerInfoByPosition(position);

    const inPause =
        currentGame.awaitingNextRound === true;

    const beerEmpty =
        isPlayerBeerEmpty(position);

    const gameWon =
        hasBeerWinner();

    const allowedTeam =
        teamCanUseBeer(player.teamIndex);

    const inactive =
        !gameWon &&
        !beerEmpty &&
        (!inPause || !allowedTeam);

    const locked =
        beerEmpty;

    const gameOverStanding =
        gameWon && !beerEmpty;

    const disabled =
        locked || inactive;

    return `
        <button
            class="playerBeerButton playerBeer_${position}
                ${inactive ? "beerInactive" : ""}
                ${locked ? "beerLocked" : ""}
                ${gameOverStanding ? "beerGameOver" : ""}"
            onclick="usePlayerBeer('${position}')"
            onpointerdown="event.stopPropagation()"
            onpointerup="event.stopPropagation()"
            ${disabled ? "disabled" : ""}>
            Bier
        </button>
    `;
}
function useTeamEraser(teamIndex) {
    if (!currentGame) return;
    if (currentGame.startSelectionActive) return;

    // Löscher nur zwischen Runden
    if (!currentGame.awaitingNextRound) {
        return;
    }

    if (!currentGame.teamEraserUsed) {
        currentGame.teamEraserUsed = createInitialTeamErasers();
    }

    const key = String(teamIndex);

    if (currentGame.teamEraserUsed[key]) {
        return;
    }

    // Pro beendeter Runde nur ein Löscher
    if (currentRoundAlreadyErased()) {
        return;
    }

    commitGameAction(() => {
        currentGame.teamEraserUsed[key] = true;

        const oldRoundResult =
            getLastRoundResultEventForCurrentRound();

        if (oldRoundResult && oldRoundResult.logId) {
            oldRoundResult.undone = true;
            oldRoundResult.replacedByEraser = true;
            markLogUndone(oldRoundResult.logId);
        }

        const eraserUseLogId =
            debugLog(`Team ${teamIndex + 1} setzt Löscher ein`);

        currentGame.events.push({
            type: "team_eraser_use",
            teamIndex: teamIndex,
            round: currentGame.round,
            timestamp: Date.now(),
            logId: eraserUseLogId
        });

        const eraserResultMessage =
            getRoundResultMessage(currentGame.round, {
                eraser: true
            });

        const eraserResultLogId =
            debugLog(eraserResultMessage);

        currentGame.events.push({
            type: "round_result",
            round: currentGame.round,
            eraser: true,
            eraserTeamIndex: teamIndex,
            timestamp: Date.now(),
            logId: eraserResultLogId,
            replacesLogId: oldRoundResult ? oldRoundResult.logId : null
        });
        currentGame.roundBeerActiveTeams =
            getBeerActiveTeamsForCurrentRound({
                eraser: true
            });
        // Nächste Runde startet mit demselben Startspieler
        currentGame.keepStartPlayerForNextRound = true;
    });
}
function getScoreDisplay() {

    const score = getCurrentScore();

    return `${formatTeamScore(
        score.team1,
        (currentGame.fieldCounts["red-1"] || 0) > 0
    )}:${formatTeamScore(
        score.team2,
        (currentGame.fieldCounts["red1"] || 0) > 0
    )}`;
}
function getFieldDomId(value) {
    return "fieldCount_" + String(value).replace("-", "minus").replace("red", "red_");
}

function updateFieldCountDisplay(value) {
    const el = document.getElementById(getFieldDomId(value));

    if (el) {
        el.textContent = getFieldCount(value);
    }
}

function updateAllFieldCountDisplays() {
    [3, 2, 1, 0, -1, -2, -3, "red1", "red-1"].forEach(updateFieldCountDisplay);
}
function getTurnKey() {
    if (!currentGame) return "";

    return `${currentGame.round}_${currentGame.turnInRound}`;
}
function checkTurnMergeRule() {
    if (!currentGame) return;

    const player = getCurrentPlayerInfo();
    const turnKey = getTurnKey();

    const turnEvents = currentGame.events.filter(e =>
        !e.merged &&
        e.turnKey === turnKey &&
        e.playerId === player.playerId &&
        e.teamIndex === player.teamIndex &&
        (e.type === "field_add" || e.type === "field_remove") &&
        e.fieldValue > 0 &&
        e.value !== "red1" &&
        e.value !== "red-1"
    );

    for (const addEvent of turnEvents.filter(e => e.type === "field_add")) {
        for (const removeEvent of turnEvents.filter(e => e.type === "field_remove")) {

           

            addEvent.merged = true;
            removeEvent.merged = true;

            markLogMerged(addEvent.logId);
            markLogMerged(removeEvent.logId);

            const addValue = addEvent.fieldValue;
            const removeValue = removeEvent.fieldValue;

            let resultText;
            let scoreDelta;

            if (addEvent.isOwn) {

                scoreDelta = removeValue - addValue;

                if (scoreDelta > 0) {
                    resultText =
                        `Wertung: ${scoreDelta}er Löscher (+${scoreDelta})`;
                } else if (scoreDelta < 0) {
                    resultText =
                        `Wertung: ${scoreDelta}er Treffer (${scoreDelta})`;
                } else {
                    resultText =
                        "Wertung: Neutral (0)";
                }

            } else {

                scoreDelta = addValue - removeValue;

                if (scoreDelta > 0) {
                    resultText =
                        `Wertung: ${scoreDelta}er Treffer (+${scoreDelta})`;
                } else if (scoreDelta < 0) {
                    resultText =
                        `Wertung: ${scoreDelta}er Treffer (${scoreDelta})`;
                } else {
                    resultText =
                        "Wertung: Neutral (0)";
                }
            }

            const actionVerb =
                addEvent.isOwn
                    ? "löscht"
                    : "kickt";

            const sign =
                addEvent.isOwn
                    ? "-"
                    : "+";

            const actionText =
                `${player.playerName} aus ${player.teamName} ` +
                `${actionVerb} ${removeValue} & trifft ${sign}${addValue}`;

            const message =
                `${actionText}, ${resultText}`;

            const logId = debugLog(message);

            const statCategory =
                getMergeStatCategoryFromEvents(addEvent, removeEvent);

            currentGame.events.push({
                type: "field_merge",
                isOwn: removeEvent.isOwn,
                addValue: addValue,
                removeValue: removeValue,
                addIsOwn: addEvent.isOwn,
                removeIsOwn: removeEvent.isOwn,
                scoreDelta: scoreDelta,
                statCategory: statCategory,
                playerId: player.playerId,
                teamIndex: player.teamIndex,
                position: player.position,
                timestamp: Date.now(),
                logId: logId,
                logText: message,
                turnKey: turnKey,
                merged: false
            });

            saveCurrentGame();
            restoreDebugLog();

            return;
        }
    }
}
function markLogMerged(logId) {
    let logs =
        JSON.parse(localStorage.getItem("debugLog"))
        || [];

    const entry =
        logs.find(x => x.id === logId);

    if (entry) {
        entry.merged = true;
    }

    localStorage.setItem(
        "debugLog",
        JSON.stringify(logs)
    );

    const el =
        document.getElementById(logId);

    if (el) {
        el.classList.add("debugMerged");
    }
}
function unmarkLogMerged(logId) {
    let logs =
        JSON.parse(localStorage.getItem("debugLog"))
        || [];

    const entry =
        logs.find(x => x.id === logId);

    if (entry) {
        entry.merged = false;
    }

    localStorage.setItem(
        "debugLog",
        JSON.stringify(logs)
    );

    const el =
        document.getElementById(logId);

    if (el) {
        el.classList.remove("debugMerged");
    }
}
function activateNextForcedTurnOrStop() {
    if (!currentGame.forcedTurnQueue) {
        currentGame.forcedTurnQueue = [];
    }

    while (currentGame.forcedTurnQueue.length > 0) {
        const position = currentGame.forcedTurnQueue[0];

        if (getPlayerCap(position) > 0) {
            currentGame.forcedTurnActive = true;
            return;
        }

        const player =
            getPlayerInfoByPosition(position);

        const noCapLogId = debugLog(
            `${player.playerName} hat keinen Kronkorken für den Sonderzug.`
        );

        currentGame.events.push({
            type: "forced_turn_no_cap",
            playerId: player.playerId,
            teamIndex: player.teamIndex,
            position: position,
            round: currentGame.round,
            turnInRound: currentGame.turnInRound,
            timestamp: Date.now(),
            logId: noCapLogId
        });

        currentGame.forcedTurnQueue.shift();
    }

    currentGame.forcedTurnActive = false;
}
renderPlayerList();
renderPlayerSelection();

if (currentGame) {
    document.getElementById("setupSection").style.display = "none";
    document.getElementById("playerSection").style.display = "none";

    if (!currentGame.round) currentGame.round = 1;
    if (currentGame.turnInRound === undefined) currentGame.turnInRound = 0;
    if (currentGame.startIndex === undefined) currentGame.startIndex = 0;

    saveCurrentGame();
    startGameTimer();
}
renderGameInfo();
restoreDebugLog();


document.addEventListener("selectstart", event => {
    event.preventDefault();
});

document.addEventListener("dragstart", event => {
    event.preventDefault();
});

window.addEventListener("selectstart", function (event) {
    event.preventDefault();
    return false;
}, { capture: true });

window.addEventListener("dragstart", function (event) {
    event.preventDefault();
    return false;
}, { capture: true });

const isTouchDevice =
    window.matchMedia("(pointer: coarse)").matches;

if (isTouchDevice) {
    document.addEventListener("contextmenu", event => {
        event.preventDefault();
    });

    window.addEventListener("contextmenu", function (event) {
        event.preventDefault();
        return false;
    }, { capture: true });
}