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