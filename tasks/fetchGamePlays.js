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

      const playLength = (playTime === 'None' ? 0 : parseInt(playTime, 10))
        + (runoffTime === 'None' ? 0 : parseInt(runoffTime, 10));

      plays.push({
        playNumber: i,
        homeOffense,
        offense: {
          number: offNum === 'None' ? null : parseInt(offNum, 10),
          coach: `/u/${offCoach.toLowerCase()}`,
        },
        defense: {
          number: defNum === 'None' ? null : parseInt(defNum, 10),
          coach: [`/u/${defCoach.toLowerCase()}`],
        },
        playType,
        result: result || 'None',
        yards: yards === 'None' ? 0 : parseInt(yards, 10),
        down: parseInt(down, 10),
        distance: parseInt(distance, 10),
        yardLine: parseInt(yardLine, 10),
        quarter: parseInt(quarter, 10),
        clock: Math.max(parseInt(clock, 10), 0), // can be negative on PATs at end of quarters
        playLength: Math.max(playLength, 0), // same
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
          number: parseInt(offNum, 10),
        },
        defense: {
          number: parseInt(defNum, 10),
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
  
  // Make it oldest to newest
  comments.sort((a, b) => a.created - b.created);

  // Filter out non-play-comments
  const filteredComments = comments.filter((comment) => {
    if (!comment.body) {
      console.log(comment);
    }
    return (
      comment.body.indexOf('has submitted') >= 0
      && comment.author.toLowerCase() === 'nfcaaofficialrefbot'
      && comment.replies
      && comment.replies.length > 0
    );
  });

  for (let i = 0; i < filteredComments.length; i += 1) {
    const comment = filteredComments[i];
    const nextComment = (i + 1) < filteredComments.length ? filteredComments[i + 1] : null;
    const play = gistPlays
      ? parsePlayComment(comment, homeTeam, awayTeam, gistPlays, nextComment)
      : parsePlayCoaches(comment, null, homeTeam, awayTeam);
    
    if (play) {
      play.playNumber = i;

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
const fetchGamePlays = async function fetchGamePlays(gistLink, gameJson, homeTeam, awayTeam) {
  if (!gistLink) {
    // Just get coaches
    return fetchInfoFromComments(gameJson, homeTeam, awayTeam, null);
  }
  
  const gistContent = await fetchGist(gistLink);

  const gistFormat = detectGistFormat(gistContent);

  if (gistFormat === 18) {
    return parseGist(gistContent, gistFormat);
  }
  if (gistFormat === 5) {
    const { plays: gistPlays } = parseGist(gistContent, gistFormat);
    return fetchInfoFromComments(gameJson, homeTeam, awayTeam, gistPlays);
  }

  throw new Error(`Could not get plays for game ${gameJson.id}`);
};

module.exports = fetchGamePlays;
