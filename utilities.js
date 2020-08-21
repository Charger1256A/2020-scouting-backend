const keys = require('./dataKeys.json');
const fs = require('fs');
const math = require('mathjs');
const { clone } = require('mathjs');

let TBAKEY = fs.readFileSync('keys.txt', 'utf8').split("\n")[2];
let TBABASE = "https://www.thebluealliance.com/api/v3"
let TBAHEADER = { headers: { "X-TBA-Auth-Key": TBAKEY } };


function renameKeys(data) {
    const cleanData = {}
    for (const [k, v] of Object.entries(data)) {
        if (k in keys.generalKeys) {
            cleanData[keys.generalKeys[k]] = v
        }
        else {
            cleanData[k] = v
        }
    }
    return (cleanData)
}

function decodeData(rawData) {
    // .replace(/:([a-zA-Z0-9_]+)/g, ':"$1"')
    rawData = rawData.replace(/ /g, '')
        .replace(/([\w]+):/g, '"$1":')
        .replace(/:([^,:\[\]\{\}]+)/g, ':"$1"')
        .replace(/:\"([\d]+\")/g, function (m, num) { return ':' + parseFloat(num) })
        .replace(/:([[{])/g, ':$1')
    let data = JSON.parse(rawData)
    data = renameKeys(data)
    return addStats(data);
}

function addStats(data) {
    let assistedClimbPoints = [0, 50, 65];

    if (data["soloHang"] == 2) {
        var soloHangPoints = [0, 25, 40]
        var hangPoints = soloHangPoints[2]
    } else if (data["soloHang" == 1]) {
        var hangPoints = 25
    } else if (data["soloHang"] == 0) {
        var hangPoints = 0
    }
    data["pointContribution"] = data["autoInner"] * 6 + data["autoOuter"] * 4 + data["autoLower"] * 2 + data["teleInner"] * 3 + data["teleOuter"] * 2 + data["teleLower"] + data["intiationLine"] * 5 + hangPoints;
    data["telePosition1Total"] = data["tele1"].lower + data["tele1"].outer + data["tele1"].inner;
    data["telePosition2Total"] = data["tele2"].lower + data["tele2"].outer + data["tele2"].inner;
    data["telePosition3Total"] = data["tele3"].lower + data["tele3"].outer + data["tele3"].inner;
    data["telePosition4Total"] = data["tele4"].lower + data["tele4"].outer + data["tele4"].inner;
    data["telePosition5Total"] = data["tele5"].lower + data["tele5"].outer + data["tele5"].inner;
    data["telePosition6Total"] = data["tele6"].lower + data["tele6"].outer + data["tele6"].inner;
    data["autoPowercellTotal"] = data["autoLower"] + data["autoOuter"] + data["autoInner"];
    data["telePowercellTotal"] = data["teleLower"] + data["teleOuter"] + data["teleInner"];
    data["telePosition"] = math.mean(data["telePosition1Total"], data["telePosition2Total"], data["telePosition3Total"], data["telePosition4Total"], data["telePosition5Total"], data["telePosition6Total"])
    data["autoPowercell"] = math.mean(data["autoInner"], data["autoOuter"], data["autoLower"])
    data["telePowercell"] = (math.mean(data["teleInner"], data["teleOuter"], data["teleLower"])) //Might multiply by three for clarity
    // data["autoPowercellMax"] = ;

    return data
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
            }

            if (values.length) {
                stats.avg[key] = math.mean(values)
            }
        }
    }
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

function updateTotal(stats, matches) {
    for (var match in matches) {
        if (!matches[match]['-']) {
            stats.total["autoPowercellTotal"] += parseInt(matches[match].autoPowercellTotal);
            if (matches[match].positionControl == 'true') {
                stats.total["positionControl"] += 1;
            }
            stats.total["robotDiedTotal"] += parseInt(matches[match].robotDied);
            if (matches[match].rotationControl == 'true') {
                stats.total["rotationControl"] += 1;
            }
            stats.total["telePosition1MatchTotal"] += matches[match].telePosition1Total;
            stats.total["telePosition2MatchTotal"] += matches[match].telePosition2Total;
            stats.total["telePosition3MatchTotal"] += matches[match].telePosition3Total;
            stats.total["telePosition4MatchTotal"] += matches[match].telePosition4Total;
            stats.total["telePosition5MatchTotal"] += matches[match].telePosition5Total;
            stats.total["telePosition6MatchTotal"] += matches[match].telePosition6Total;
            stats.total["telePowercellTotal"] += parseInt(matches[match].telePowercellTotal);
            if (matches[match].soloHang == 1) {
                stats.total["soloHangTotal"] += 1
            } else if (matches[match].soloHang == 2) {
                stats.total["soloBalancedHangTotal"] += 1
            }
            if (matches[match].assistedHang == 1) {
                stats.total["assistedHangTotal"] += 1
            } else if (matches[match].assistedHang == 2) {
                stats.total["assistedBalancedHangTotal"] += 1
            }
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
    updateTotal, updateTotal,
    getEventData: getEventData,
    getTeamMatches: getTeamMatches
}
