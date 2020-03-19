/**
 * Parses the plays from the given gist, or gets them from reddit if bad.
 */
const https = require('https');
const parsePlayComment = require('./parsePlayComment');
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
  const rows = gistContent.split('\n');
  if (gistFormat === 18) {
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const cols = row.split('|');
      const [, , quarter, clock, yardLine, offenseTeam, down, distance,
        defNum, offNum, defCoach, offCoach, playType, , result, yards,
        playTime, runoffTime] = cols;
      plays.push({
        homeOffense: (offenseTeam === 'home'),
        offense: {
          number: parseInt(offNum, 10),
          coach: offCoach,
        },
        defense: {
          number: parseInt(defNum, 10),
          coach: [defCoach],
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

  return plays;
};

/**
 * Fetches the plays from a game's comments.
 * @param {String} gameId Game's Reddit post ID
 * @param {import('snoowrap')} reddit Snoowrap instance
 * @param {Object} homeTeam The home team's info
 * @param {Object} homeTeam The away team's info
 * @param {Object[]} gistPlays The list of plays from the gist.
 */
const fetchPlaysFromComments = function fetchPlaysFromComments(
  gameId, reddit, homeTeam, awayTeam, gistPlays,
) {
  return new Promise((resolve, reject) => {
    const plays = [];
    reddit.getSubmission(gameId)
      .expandReplies({ limit: Infinity, depth: Infinity })
      .catch(reject)
      .then((post) => {
        const { comments } = post;
        comments.sort((a, b) => a.created - b.created); // Make it oldest to newest
        // fs.writeFile('test.json', JSON.stringify(comments, null, 2), err => console.error(err));
        for (let i = 0; i < comments.length; i += 1) {
          const comment = comments[i];
          // If is a play comment
          if (comment.body.indexOf('has submitted') >= 0) {
            plays.push(parsePlayComment(comment, homeTeam, awayTeam, gistPlays));
          }
        }
        resolve(plays);
      });
  });
};

/**
 * Returns an array of play objects
 * @param {String} gistLink URL to the play's gist
 * @param {String} gameId Game's Reddit post ID
 * @param {import('snoowrap')} reddit Snoowrap instance
 * @param {Object} homeTeam The home team's info
 * @param {Object} homeTeam The away team's info
 */
const fetchGamePlays = function fetchGamePlays(gistLink, gameId, reddit, homeTeam, awayTeam) {
  return new Promise((resolve, reject) => {
    if (!gistLink) {
      return resolve(null); // Not possible to get plays for these games.
    }
    return fetchGist(gistLink)
      .catch(reject)
      .then((gistContent) => {
        const gistFormat = detectGistFormat(gistContent);
        if (gistFormat === 18) {
          const plays = parseGist(gistContent, gistFormat);
          return resolve(plays);
        }
        if (gistFormat === 5) {
          const gistPlays = parseGist(gistContent, gistFormat);
          return fetchPlaysFromComments(gameId, reddit, homeTeam, awayTeam, gistPlays)
            .catch(reject)
            .then(resolve);
        }
        return reject(new Error(`Could not get plays for game ${gameId}`));
      });
  });
};

module.exports = fetchGamePlays;
