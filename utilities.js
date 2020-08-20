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
            var hangPoints = soloHangPoints[1]
        } else {
            var HangPoints = soloHangPoints[0]
        }
        console.log(data["intiationLine"]*5)
        // misspell
        data["pointContribution"] = data["autoInner"]*6 + data["autoOuter"]*4 + data["autoLower"]*2 + data["teleInner"]*3 + data["teleOuter"]*2 + data["teleLower"] + data["intiationLine"]*5 + hangPoints ;
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

        // autoPowercell = 0
        // autoOuter

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

        // Pass in 2019 data in the old 
        // firebase to see how this works

        return stats;
    }
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
