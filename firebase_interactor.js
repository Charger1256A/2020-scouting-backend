const fs = require('fs')
const firebase = require('firebase');

firebase.initializeApp({
    apiKey: "AIzaSyBDvxiLJvHh-dEvNQph1hys0oSovX7bWGI",
    authDomain: "scouting-backend.firebaseapp.com",
    databaseURL: "https://scouting-backend.firebaseio.com",
    projectId: "scouting-backend",
    storageBucket: "scouting-backend.appspot.com",
    messagingSenderId: "78773607889",
});

firebase.auth().signInAnonymously().catch(function(error) {
    console.log(error);
});

var db = firebase.database();

function get(path) {
    return new Promise(function (resolve, reject) {
        db.ref(path).once("value").then(function (snapshot) {
            resolve(snapshot.val());
        });
    });
}

module.exports = {
    get: get
 }