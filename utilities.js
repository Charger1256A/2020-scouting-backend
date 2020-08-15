const keys = require('./dataKeys.json');
const fs = require('fs');
const math = require('mathjs');

let TBAKEY = fs.readFileSync('keys.txt', 'utf8').split("\n")[2];
let TBABASE = "https://www.thebluealliance.com/api/v3"
let TBAHEADER = { headers: { "X-TBA-Auth-Key": TBAKEY } };


function decodeData(rawData) {
    let data = {};
    let d = rawData.substring(1, rawData.length - 1).split(",");
    // tele data only contains lower:0; put exception for tele data
    for (var i in d) {
        let key = d[i].substring(0, d[i].indexOf(":"));
        let value = d[i].substring(d[i].indexOf(":") + 1, d[i].length).replace(/>/g, ' ').replace(/</g, ',');
        keys.generalKeys[key] && !value.includes("{i") ? data[keys.generalKeys[key]] = value : "";
    }
    let autoEvents = parseEvents(rawData, "aE");
    let teleEvents = parseEvents(rawData, "tE");
    for (var key in keys.eventKeys) {
        let oldKey = new RegExp(`"${key}"`, 'g');
        let newKey = `"${keys.eventKeys[key]}"`;
        autoEvents = autoEvents.replace(oldKey, newKey);
        teleEvents = teleEvents.replace(oldKey, newKey);
    }
    return addStats(Object.assign(data, JSON.parse(autoEvents), JSON.parse(teleEvents)));
}

function parseEvents(rawData, event) {
    let events = "";
    // parse autoEvents from raw string data
    for (var i = rawData.indexOf(`${event}:`); i < rawData.length; i++) {
        if (rawData.charAt(i).match(/[a-z]/i)) {
            events += rawData.charAt(i - 1).match(/[a-z]/i) ? rawData.charAt(i) : `"` + rawData.charAt(i);
        } else {
            events += rawData.charAt(i - 1).match(/[a-z]/i) ? `"` + rawData.charAt(i) : rawData.charAt(i);
        }
        var sndLastChar = events[events.length - 2];
        // if last character in current string is "]", and the character before that is "[" or "}"
        if (events[events.length - 1] == "]" && (sndLastChar == "}" || sndLastChar == "[")) {
            break;
        }
    }
    return "{" + events + "}";
}

function addStats(data) {
    let soloHangPoints = [0, 25, 40];
    let assistedClimbPoints = [0, 50, 65];
    let stats = ["teleCargoHatch", "teleCargoCargo", "teleRocketHatch", "teleRocketCargo", "teleLevel2Hatch", "teleLevel2Cargo",
        "teleLevel3Hatch", "teleLevel3Cargo", "teleFailedLevel2Hatch", "teleFailedLevel3Hatch", "teleFailedLevel2Cargo", "teleFailedLevel3Cargo"];
    for (var i in stats)
        data[stats[i]] = 0
    for (var e in data.teleEvents) {
        let eData = data.teleEvents[e].event;
        if (eData.location.includes('Rocket')) {
            eData.success == 1 ? data[`teleRocket${eData.itemScored}`] += 1 : "";
            if (eData.position[1] > 1) {
                eData.success == 1 ? data[`teleLevel${eData.position[1]}${eData.itemScored}`] += 1 : data[`teleFailedLevel${eData.position[1]}${eData.itemScored}`] += 1;
            }
        } else {
            data[`teleCargo${eData.itemScored}`] += 1;
        }
    }
    data["autoFailedHatch"] = 0;
    data["autoFailedCargo"] = 0
    // hatch and cargo rate
    // specific to 2019
    for (var e in data.autoEvents) {
        let eData = data.autoEvents[e].event;
        if (eData.success == 0) {
            data[`autoFailed${eData.itemScored}`] += 1;
        }
    }
    data["habBonus"] = 0
    data["teleUpperHatch"] = data["teleLevel2Hatch"] + data["teleLevel3Hatch"];
    data["teleUpperCargo"] = data["teleLevel2Cargo"] + data["teleLevel3Cargo"];
    data["habBonus"] = data.autoEvents.length > 0 ? 1 : data["habBonus"]; // make sure that if autoEvents happened, then habBonus is definitely 1.
    data["habBonus"] = data["habBonus"] * parseInt(data["startingPosition"].charAt(1));

    // data["climbBonus"] = soloClimbPoints[data["soloClimb"]] + assistedClimbPoints[data["assistedClimb"]];
    data["autoHatch"] = 0;
    // data["pointContribution"] = data["habBonus"]*3 + data["autoHatch"]*2 + data["autoCargo"]*3 + data["teleHatch"]*2 + data["teleCargo"]*3 + data["climbBonus"];
    // data["teleCycles"] = parseInt(data["teleHatch"]) + parseInt(data["teleCargo"]);
    // Above specific to 2019


    data = errorTest(data);


    return data;
}


function errorTest(data) {
    errors = []
    duplicatesFound = false
    rocketLevels = {
        "Hatch": { "Left Rocket": { 1: 0, 2: 0, 3: 0 }, "Right Rocket": { 1: 0, 2: 0, 3: 0 } },
        "Cargo": { "Left Rocket": { 1: 0, 2: 0, 3: 0 }, "Right Rocket": { 1: 0, 2: 0, 3: 0 } }
    }
    // populate rocket level counters
    for (var i in data["teleEvents"]) {
        let event = data["teleEvents"][i]["event"];
        if (event["location"] != "Cargo" && event["success"] == 1) rocketLevels[event["itemScored"]][event["location"]][event["position"][1]] += 1;
    }
    // check for rocket level duplicates
    for (var item in rocketLevels) {
        for (var rocket in rocketLevels[item]) {
            let levels = rocketLevels[item][rocket];
            for (var level in levels) {
                if (levels[level] > 2) errors.push(`Impossible ${item} Combination in Rocket Level ${level}`);
            }
        }
    }
    data["errors"] = errors;
    return data;
}

function updateAverages(stats, matches) {
    for (var key in stats.avg) {
        if (!key.includes("Climb") && !key.includes("Rate")) {
            let values = [];
            for (var match in matches) {
                let avg = matches[match][key.replace("Average", '')]
                if (!matches[match]['-'] && !(typeof (avg) === 'undefined') && (avg != -1)) {
                    values.push(avg);
                }
                // !matches[match]['-'] && avg != -1 ? values.push(avg) : "";
            }
            stats.avg[key] = values.length ? math.mean(values) : stats.avg[key];
        }
    }
    let soloClimb2 = [];
    let soloClimb3 = [];
    let assistedClimb2 = [];
    let assistedClimb3 = [];
    let totalAutoHatch = 0; // the sums for all matches
    let totalAutoCargo = 0;
    let totalAutoFailedHatch = 0;
    let totalAutoFailedCargo = 0;
    for (var match in matches) {
        if (!matches[match]['-']) {
            totalAutoHatch += parseInt(matches[match].autoHatch);
            totalAutoCargo += parseInt(matches[match].autoCargo);
            totalAutoFailedHatch += parseInt(matches[match].autoFailedHatch);
            totalAutoFailedCargo += parseInt(matches[match].autoFailedCargo);
            let solo = matches[match].soloClimb;
            let assisted = matches[match].assistedClimb;
            // forgive me for these ternaries. probably the ugliest ternary usage you have seen.
            solo <= 1 ? (soloClimb2.push(0) && soloClimb3.push(0)) : (solo == 2 ? (soloClimb2.push(1) && soloClimb3.push(0)) : (soloClimb3.push(1) && soloClimb2.push(0)));
            assisted == 0 ? (assistedClimb2.push(0) && assistedClimb3.push(0)) : (assisted == 1 ? (assistedClimb2.push(1) && assistedClimb3.push(0)) : (assistedClimb3.push(1) && assistedClimb2.push(0)));
        }
    }
    stats.avg["autoHatchRate"] = (totalAutoHatch + totalAutoFailedHatch) ? totalAutoHatch / (totalAutoHatch + totalAutoFailedHatch) : "-";
    stats.avg["autoCargoRate"] = (totalAutoCargo + totalAutoFailedCargo) ? totalAutoCargo / (totalAutoCargo + totalAutoFailedCargo) : "-";
    stats.avg["soloClimbLevel2Average"] = math.mean(soloClimb2);
    stats.avg["soloClimbLevel3Average"] = math.mean(soloClimb3);
    stats.avg["assistedClimbLevel2Average"] = math.mean(assistedClimb2);
    stats.avg["assistedClimbLevel3Average"] = math.mean(assistedClimb3);

    return stats;
}

function updateStDevs(stats, matches) {
    for (var key in stats.stDev) {
        let values = [];
        for (var match in matches) {
            let stdev = matches[match][key.replace("Stdev", '')]
            if (!matches[match]['-'] && !(typeof (stdev) === 'undefined') && (stdev != -1)) {
                values.push(stdev);
            }
        }
        if (values.length >= 1) {
            stats.stDev[key] = math.std(values);
        }
    }
    return stats;
}

function updateMaxMin(stats, matches) {
    for (var key in stats.max) {
        let values = [];
        for (var match in matches) {
            let max = matches[match][key.replace("Max", '')]
            if (!matches[match]['-'] && !(typeof (max) === 'undefined') && (max != -1)) {
                values.push(max)
            }
        }
        if (values.length >= 1) {
            stats.max[key] = math.max(values);
            stats.min[key.replace("Max", "Min")] = math.min(values);
        }
    }
    return stats;
}

/* ----------- TBA Functions ----------- */
/* 
    Gets event data (teams and team's matches) and returns as array of dictionaries 
    eventKey - key of event to fetch from TBA.
*/
function getEventData(eventKey) {
    return new Promise(function (resolve, reject) {
        fetch(`${TBABASE}/event/${eventKey}/teams/simple`, TBAHEADER)
            .then((response) => response.json()).then((res) => {
                let teamList = [];
                res.Errors ? resolve([{ "Error": "eventKey is not Valid" }]) : ""
                for (var i in res) {
                    let teamNo = res[i].team_number;
                    let teamName = res[i].nickname;
                    getTeamMatches(teamNo, eventKey).then((matches) => {
                        teamList.push({ team: teamNo, name: teamName, matches: matches });
                        if (teamList.length == res.length) {
                            teamList.sort((a, b) => a.team - b.team);
                            resolve(teamList);
                        }
                    });
                }
            }).catch((error) => {
                reject(error);
            });
    });
}

/*
    Helper function for getEventData which returns list of matches for a team in an event
    teamNo - team number (ex: 8)
    eventKey - event key (ex: 2018casj)
*/
function getTeamMatches(teamNo, eventKey) {
    return fetch(`${TBABASE}/team/frc${teamNo}/event/${eventKey}/matches/simple`, TBAHEADER)
        .then((response) => response.json()).then((matches) => {
            let matchList = [];
            for (var i in matches) {
                matches[i].comp_level == "qm" ? matchList.push(matches[i].match_number) : "";
            }
            return (matchList.sort((a, b) => a - b));
        });
}


module.exports = {
    decodeData: decodeData,
    updateStDevs: updateStDevs,
    updateAverages, updateAverages,
    updateMaxMin, updateMaxMin,
    getEventData: getEventData,
    getTeamMatches: getTeamMatches
}
