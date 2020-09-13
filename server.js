const express = require('express')
const bodyParser = require('body-parser');
const fs = require('fs');
const util = require('./utilities');
const fb = require('./firebase_interactor');
const app = express()
const PORT = 4000
// Listens on PORT 4040 for ngrok pipe


// to run backend, must have file named "keys.txt" in same directory
let auth = fs.readFileSync('keys.txt', 'utf8').split("\n")[0];

app.use(bodyParser.json())

// upload match data post route, firebase interactor takes care of it
app.post('/upload_data/:auth/', (req, res) => {
    if (req.params.auth == auth) {
        req.body.data.forEach(rawData => {
            let data = util.decodeData(rawData);
            console.log(`${data.event} | Match: ${data.match}, Team: ${data.team}`);
            fb.uploadMatch(data).then((dbResponse) => {
                dbResponse == true ? res.send(`Uploaded data for Team ${data.team}`) : res.send(`Unable to upload data for Team ${data.team}. Contact Caleb if this error persists.`);
            });
        });
    } 
    else
    {
        res.send(`Bad auth`) 
    }
})

// event initializer route, grabs matches from tba and puts in firebase
app.post('/initialize_event/:key/:auth/', (req, res) => {
    if (req.params.auth == auth) {
        let eventKey = req.params.key;
         util.getEventData(eventKey).then((eventData) => {
            if (eventData[0]['team']) {
                fb.initializeEvent(eventKey, eventData).then((dbResponse) => {
                    dbResponse == true ? res.send("success") : res.send("error");
                });
            }

        });
    }

})

app.get('/grab_data/:key/', (req,res) => {
    let path = `/${req.params.key}/teams`;
    fb.get(path).then((dbResponse) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.send(dbResponse);
    })
})


app.listen(PORT, () => {
    console.log("Authenticating...");
    console.log(`Running server on port ${PORT}`)
})  