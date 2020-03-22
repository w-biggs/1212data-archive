/**
 * Parses the plays from the given gist, or gets them from reddit if bad.
 */
const https = require('https');
const { parsePlayCoaches, parsePlayComment } = require('./parsePlayComment');
// const fs = require('fs');

const fetchGist = function fetchGistContents(gist) {
  return new Promise((resolve, reject) => {
    // The reddit API URL that returns the info we need.
    const url = `${gist.replace('github.com', 'githubusercontent.com')}/raw/`;
    // Send a request to the API
    const request = https.get(url, (response) => {
      // Handle http errors
      if (response.statusCode < 200 || response.statusCode > 299) {
        reject(new Error(`Failed to load page, status code: ${response.statusCode}`));
      }
      // Temporary data holder
      const body = [];
      // Push chunks to the body array
      response.on('data', chunk => body.push(chunk));
      // Join chunks and resolve promise
      response.on('end', () => resolve(body.join('')));
    });
    // Handle connection errors
    request.on('error', err => reject(err));
  });
};

/**
 * Detects whether the gist is of the old format or new format
 * @param {String} gistContent The content of the gist play list
 */
const detectGistFormat = function detectGistFormat(gistContent) {
  const gistRowLength = gistContent.split('\n')[0].split('|').length;
  if (gistRowLength === 5) {
    return 5; // old format
  }
  if (gistRowLength === 18) {
    return 18; // new format
  }
  console.error('Unknown gist format, skipping gist.');
  return false;
};

/**
 * Parse the gist and output an array of play objects.
 * @param {String} gistContent The contents of the gist.
 * @param {Number} gistFormat The type of gist we're parsing.
 */
const parseGist = function parseGist(gistContent, gistFormat) {
  const plays = [];
  const teamCoaches = {
    home: [],
    away: [],
  };
  const rows = gistContent.split('\n');
  if (gistFormat === 18) {
    // skip first row, which is the header row
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      const cols = row.split('|');
      const [, , quarter, clock, yardLine, offenseTeam, down, distance,
        defNum, offNum, defCoach, offCoach, playType, , result, yards,
        playTime, runoffTime] = cols;
      const homeOffense = (offenseTeam === 'home');

      const prefixedOffCoach = `/u/${offCoach.toLowerCase()}`;
      const prefixedDefCoach = `/u/${defCoach.toLowerCase()}`;

      // Put home coach in list
      let foundHome = false;
      for (let j = 0; j < teamCoaches.home.length; j += 1) {
        if (teamCoaches.home[j].name === (homeOffense ? prefixedOffCoach : prefixedDefCoach)) {
          foundHome = true;
          teamCoaches.home[j].plays += 1;
        }
      }
      if (!foundHome) {
        teamCoaches.home.push({
          name: (homeOffense ? prefixedOffCoach : prefixedDefCoach),
          plays: 1,
        });
      }

      // Put away coach in list
      let foundAway = false;
      for (let j = 0; j < teamCoaches.away.length; j += 1) {
        if (teamCoaches.away[j].name === (homeOffense ? prefixedDefCoach : prefixedOffCoach)) {
          foundAway = true;
          teamCoaches.away[j].plays += 1;
        }
      }
      if (!foundAway) {
        teamCoaches.away.push({
          name: (homeOffense ? prefixedDefCoach : prefixedOffCoach),
          plays: 1,
        });
      }

      plays.push({
        homeOffense,
        offense: {
          number: parseInt(offNum, 10),
          coach: `/u/${offCoach.toLowerCase()}`,
        },
        defense: {
          number: parseInt(defNum, 10),
          coach: [`/u/${defCoach.toLowerCase()}`],
        },
        playType: playType.replace('Play.', ''),
        result: result.replace('Result.', ''),
        yards: parseInt(yards, 10),
        down: parseInt(down, 10),
        distance: parseInt(distance, 10),
        yardLine: parseInt(yardLine, 10),
        quarter: parseInt(quarter, 10),
        clock: parseInt(clock, 10),
        playLength: parseInt(playTime, 10) + parseInt(runoffTime, 10),
      });
    }
  } else {
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const cols = row.split('|');

      const infoRegex = /(.+?) = .+ = (.+?), (.+?) /gm;
      const infoMatch = infoRegex.exec(cols[0]);
      const [, playType, result, yards] = infoMatch;

      const posRegex = /([0-9]+) and ([0-9]+) on ([0-9]+)/gm;
      const posMatch = posRegex.exec(cols[1]);
      const [, down, distance, yardLine] = posMatch;

      const [offNum, defNum] = cols[3].trim().split(', ');

      plays.push({
        homeOffense: (cols[4].trim() === 'home'),
        offense: {
          number: offNum,
        },
        defense: {
          number: defNum,
        },
        playType: playType.replace('Play.', ''),
        result: result.replace('Result.', ''),
        yards: (yards === 'None') ? 0 : parseInt(yards, 10),
        down: parseInt(down, 10),
        distance: parseInt(distance, 10),
        yardLine: parseInt(yardLine, 10),
      });
    }
  }

  return {
    plays,
    teamCoaches,
  };
};

/**
 * Fetches the plays from a game's comments.
 * @param {Object} gameJson Game's json
 * @param {Object} homeTeam The home team's info
 * @param {Object} homeTeam The away team's info
 * @param {Object[]} gistPlays The list of plays from the gist.
 */
const fetchInfoFromComments = function fetchInfoFromComments(
  gameJson, homeTeam, awayTeam, gistPlays,
) {
  const plays = [];
  const teamCoaches = {
    home: [],
    away: [],
  };
  const { comments } = gameJson;
  comments.sort((a, b) => a.created - b.created); // Make it oldest to newest
  // fs.writeFile('test.json', JSON.stringify(comments, null, 2), err => console.error(err));
  for (let i = 0; i < comments.length; i += 1) {
    const comment = comments[i];
    // If is a play comment
    if (comment.body.indexOf('has submitted') >= 0 && comment.author.name.toLowerCase() === 'nfcaaofficialrefbot') {
      const play = gistPlays
        ? parsePlayComment(comment, homeTeam, awayTeam, gistPlays)
        : parsePlayCoaches(comment, null, homeTeam, awayTeam);

      const offCoach = gistPlays ? play.offense.coach : play.offCoach;
      const defCoach = gistPlays ? play.defense.coach : play.defCoach;
      
      const homeCoaches = play.homeOffense ? [offCoach] : defCoach;
      const awayCoaches = play.homeOffense ? defCoach : [offCoach];

      // Get home coaches
      for (let j = 0; j < homeCoaches.length; j += 1) {
        let foundHome = false;
        for (let k = 0; k < teamCoaches.home.length; k += 1) {
          if (teamCoaches.home[k].name === homeCoaches[j]) {
            foundHome = true;
            teamCoaches.home[k].plays += 1;
          }
        }
        if (!foundHome) {
          teamCoaches.home.push({
            name: homeCoaches[j],
            plays: 1,
          });
        }
      }
      // Get away coaches
      for (let j = 0; j < awayCoaches.length; j += 1) {
        let foundAway = false;
        for (let k = 0; k < teamCoaches.away.length; k += 1) {
          if (teamCoaches.away[k].name === awayCoaches[j]) {
            foundAway = true;
            teamCoaches.away[k].plays += 1;
          }
        }
        if (!foundAway) {
          teamCoaches.away.push({
            name: awayCoaches[j],
            plays: 1,
          });
        }
      }
      if (gistPlays) {
        plays.push(play);
      }
    }
  }
  return {
    plays,
    teamCoaches,
  };
};

/**
 * Returns an array of play objects
 * @param {String} gistLink URL to the play's gist
 * @param {Object} gameJson Game's json
 * @param {Object} homeTeam The home team's info
 * @param {Object} homeTeam The away team's info
 */
const fetchGamePlays = function fetchGamePlays(gistLink, gameJson, homeTeam, awayTeam) {
  return new Promise((resolve, reject) => {
    if (!gistLink) {
      // Just get coaches
      return resolve(fetchInfoFromComments(gameJson, homeTeam, awayTeam, null));
    }
    return fetchGist(gistLink)
      .catch(reject)
      .then((gistContent) => {
        const gistFormat = detectGistFormat(gistContent);
        if (gistFormat === 18) {
          return resolve(parseGist(gistContent, gistFormat));
        }
        if (gistFormat === 5) {
          const { plays: gistPlays } = parseGist(gistContent, gistFormat);
          return resolve(fetchInfoFromComments(gameJson, homeTeam, awayTeam, gistPlays));
        }
        return reject(new Error(`Could not get plays for game ${gameJson.id}`));
      });
  });
};

module.exports = fetchGamePlays;
