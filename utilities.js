const keys = require('./dataKeys.json');
const fs = require('fs');
const math = require('mathjs');

let TBAKEY = fs.readFileSync('keys.txt', 'utf8').split("\n")[2];
let TBABASE = "https://www.thebluealliance.com/api/v3"
let TBAHEADER = {headers: {"X-TBA-Auth-Key": TBAKEY}};

function decodeData(rawData) {
    let data = {};
    let d = rawData.substring(1, rawData.length-1).split(",");
    for (var i in d) {
        let key = d[i].substring(0, d[i].indexOf(":"));
        let value = d[i].substring(d[i].indexOf(":")+1, d[i].length).replace(/>/g, ' ').replace(/</g, ',');
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
            events += rawData.charAt(i-1).match(/[a-z]/i) ? rawData.charAt(i) : `"` + rawData.charAt(i);
        } else {
            events += rawData.charAt(i-1).match(/[a-z]/i) ? `"` + rawData.charAt(i) : rawData.charAt(i);
        }
        var sndLastChar = events[events.length - 2];
        // if last character in current string is "]", and the character before that is "[" or "}"
        if (events[events.length-1] == "]" && (sndLastChar == "}" || sndLastChar == "[")) {
            break;
        }
    }
    return "{" + events + "}";
}

function addStats(data) {
    let soloHangPoints = [0,25,40];
    let assistedClimbPoints = [0,50,65];
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
    for (var e in data.autoEvents) {
        let eData = data.autoEvents[e].event;
        if (eData.success == 0) {
            data[`autoFailed${eData.itemScored}`] += 1;
        }
    }
    data["teleUpperHatch"] = data["teleLevel2Hatch"] + data["teleLevel3Hatch"];
    data["teleUpperCargo"] = data["teleLevel2Cargo"] + data["teleLevel3Cargo"];
    data["habBonus"] = data.autoEvents.length > 0 ? 1 : data["habBonus"]; // make sure that if autoEvents happened, then habBonus is definitely 1.
    data["habBonus"] = data["habBonus"] * parseInt(data["startingPosition"].charAt(1));
    data["climbBonus"] = soloClimbPoints[data["soloClimb"]] + assistedClimbPoints[data["assistedClimb"]];
    data["pointContribution"] = data["habBonus"]*3 + data["autoHatch"]*2 + data["autoCargo"]*3 + data["teleHatch"]*2 + data["teleCargo"]*3 + data["climbBonus"];
    data["teleCycles"] = parseInt(data["teleHatch"]) + parseInt(data["teleCargo"]);
    data = errorTest(data);
    return data;
}

module.exports = {
    decodeData: decodeData,
 }

