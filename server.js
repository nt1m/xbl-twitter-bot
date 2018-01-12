/* Setting things up. */

if (!process.env.IGNORE_ENV_FILE) {
  var env = require('node-env-file');
  env(__dirname + '/.env');
}

var path = require('path'),
    express = require('express'),
    app = express(),   
    Twit = require('twit'),
    fetch = require('node-fetch'),
    fs = require('fs'),
    config = {
    /* Be sure to update the .env file with your API keys. See how to get them: https://botwiki.org/tutorials/how-to-create-a-twitter-app */      
      twitter: {
        consumer_key: process.env.CONSUMER_KEY,
        consumer_secret: process.env.CONSUMER_SECRET,
        access_token: process.env.ACCESS_TOKEN,
        access_token_secret: process.env.ACCESS_TOKEN_SECRET
      }
    },
    T = new Twit(config.twitter);

app.use(express.static('public'));

app.all("/", function(req, resp) {
  resp.send('Hello world');
  resp.sendStatus(200);
});

app.all("/tweet", async function (request, response) {
  console.log("/tweet endpoint reached");
  try {
    var resp = response;
    var stats = await fetchGHData();
    var lastTweetedCommit = await readFilePromise("last-commit.txt");
    var lastStatsCommit = getLatestCommit(stats);
    
    if (lastStatsCommit == lastTweetedCommit) {
      resp.send('OK');
      resp.sendStatus(200);
      console.log("Already tweeted", lastTweetedCommit);
      return;
    }

    var tweet = getTweetFromStats(statsify(stats[lastStatsCommit], stats));
  
    T.post('statuses/update', { status: tweet }, function(err, data, response) {
      if (err){
        resp.sendStatus(500);
        console.error('Error tweeting', lastTweetedCommit);
        console.error(err);
      } else {
        resp.send('OK');
        resp.sendStatus(200);
        console.log("Successfully tweeted", lastTweetedCommit);
      }
      fs.writeFile(__dirname + '/last-commit.txt', lastStatsCommit, function (err) {
        /* TODO: Error handling? */
      });
    });
  } catch (e) {
    console.error(e);
  }
});

var listener = app.listen(process.env.PORT, function () {
  console.log('Your bot is running on port ' + listener.address().port);
});

  
async function readFilePromise(file) {
  return new Promise((res, rej) => {
    fs.readFile(__dirname + '/' + file, {encoding: 'utf8', flag: 'a+'}, function (err, contents) {
      if (err) {
        rej(err);
      } else {
        res(contents);
      }
    });
  });
}
  
var GITHUB_STATS_URL = "https://bgrins.github.io/xbl-analysis/graph/xbl-counts.js";

async function fetchGHData() {
  let response = await fetch(GITHUB_STATS_URL);
  let regex = /var SORTED_BINDINGS = {[^]*};/igm;
  let regex2 = /var DATA = /igm;
  
  let text = await response.text();
  
  text = text.replace(regex, "").replace(regex2, "").replace(/};/igm, "}");

  return JSON.parse(JSONize(text));
}

function getNumberOfBindings(rawStats) {
  return rawStats.numBindings;
}

function statsify(rawStats, allStats) {
  return {
    percentageOfBindings: getNumberOfBindings(rawStats) / getNumberOfBindings(allStats[getFirstCommit(allStats)]), 
    numOfBindings: getNumberOfBindings(rawStats),
  }
}

function getTweetFromStats(stats) {
  let percentage = (stats.percentageOfBindings * 100).toFixed(2);
  return `We're down to ${stats.numOfBindings} bindings, which is about ${percentage}% of what we had.`
}

  
function getFirstCommit(stats) {
  let first;
  for (var i in stats) {
    first = i;
    break;
  }
  return first;
}

function getLatestCommit(stats) {
  let last;
  for (var i in stats) {
    last = i;
  }
  return last;
}

function JSONize(str) {
  return str
    // wrap keys without quote with valid double quote
    .replace(/([\$\w]+)\s*:/g, function(_, $1){return '"'+$1+'":'})    
    // replacing single quote wrapped ones to double quote 
    .replace(/'([^']+)'/g, function(_, $1){return '"'+$1+'"'})         
}
