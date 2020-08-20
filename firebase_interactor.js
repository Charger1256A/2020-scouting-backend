const fs = require('fs')
const firebase = require('firebase');
const statData = require('./stats.json');
const util = require('./utilities');

const firebaseConfig = {
    apiKey: "AIzaSyBDvxiLJvHh-dEvNQph1hys0oSovX7bWGI",
    authDomain: "scouting-backend.firebaseapp.com",
    databaseURL: "https://scouting-backend.firebaseio.com",
    projectId: "scouting-backend",
    storageBucket: "scouting-backend.appspot.com",
    messagingSenderId: "78773607889",
    appId: "1:78773607889:web:9d6252eaa0939bb2d114f0",
    measurementId: "G-9YDWE6V65K"
};
firebase.initializeApp(firebaseConfig);
var db = firebase.database();

function get(path) {
    return new Promise(function (resolve, reject) {
        db.ref(path).once("value").then(function (snapshot) {
            resolve(snapshot.val());
        });
    });
}

function uploadMatch(data) {
    let event = data.event;
    let match = parseInt(data.match.replace('Q', ''));
    let team = data.team;
    return new Promise(function (resolve, reject) {
        db.ref(`/${event}/teams/${team}/qm/${match}`).set(data).then(() => {
            updateStats(event, team, data);
            resolve(true);
        }).catch(() => {
            reject(false);
        });
    });
}

function updateStats(event, team) {
    db.ref(`/${event}/teams/${team}`).once("value").then(function (snapshot) {
        let stats = snapshot.val().stats;
        let matches = snapshot.val().qm;
        stats = util.updateAverages(stats, matches);
        stats = util.updateStDevs(stats, matches);
        stats = util.updateMaxMin(stats, matches);
        db.ref(`/${event}/teams/${team}/stats`).update(stats);
    });
}

function initializeEvent(event, data) {
    let teamData = {};
    for (var i in data) {
        let matches = {};
        data[i].matches.forEach(match => {
            matches[match] = {"-": "-"};
        });
        teamData[data[i].team] = {name: data[i].name, qm: matches, stats: statData};
    }
    return new Promise(function (resolve, reject) {
        db.ref(`/${event}/teams`).update(teamData).then(() => {
            console.log(`Initialized Firebase for ${event}`);
            resolve(true);
        }).catch(() => {
            reject(false);
        });
    });
}

module.exports = {
    uploadMatch: uploadMatch,
    updateStats: updateStats,
    initializeEvent: initializeEvent,
    get: get
 }
