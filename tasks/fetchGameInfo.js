/**
 * Gets the game's info from Reddit and outputs the data needed for the database
 */
const Snoowrap = require('snoowrap');
const Team = require('../models/teams/team.model');
const Coach = require('../models/coach.model');
const config = require('../.config');
const fetchGamePlays = require('./fetchGamePlays');

const reddit = new Snoowrap(config);

const parseGameJson = function parseGameJson(gameJson, gameId) {
  return new Promise((resolve, reject) => {
    const postBody = gameJson.selftext;
  
    /**
     * Benchmarked this - multiple small regexes is twice as fast.
     */
    const teamInfoRegex = /Defense\n.*\n\[(.+)\].+\|(.+)\|(.+)\n\[(.+)\].+\|(.+)\|(.+)/gm;
    const teamInfoMatch = teamInfoRegex.exec(postBody);
    const [, awayTeamName, awayOffense, awayDefense,
      homeTeamName, homeOffense, homeDefense] = teamInfoMatch;
  
    const homeTeam = {
      offense: homeOffense,
      defense: homeDefense,
      team: homeTeamName,
    };
    const awayTeam = {
      offense: awayOffense,
      defense: awayDefense,
      team: awayTeamName,
    };
  
    const playsLinkRegex = /\[Plays\]\((.+)\)/gm;
    const playsLinkMatch = playsLinkRegex.exec(postBody);
    const playsLink = playsLinkMatch[1];
  
    const isComplete = postBody.indexOf('Game complete');
  
    fetchGamePlays(playsLink, gameId, reddit, homeTeam, awayTeam)
      .catch(reject)
      .then((plays) => {
        resolve({
          gameId,
          startTime: gameJson.created,
          endTime: gameJson.edited, // Time of last update to score
          homeTeam,
          awayTeam,
          plays,
          live: !isComplete,
        });
      });
  });
};

/**
 * Get a team's ref from their name.
 * @param {String} teamName The name of the team to get the ref for.
 */
const getTeamRef = function getTeamRefFromName(teamName) {
  return new Promise((resolve, reject) => {
    Team.findOne({ name: teamName })
      .catch(reject)
      .then((team) => {
        if (!team) {
          console.error(`Team ${teamName} not found in database.`);
        }
        resolve(team._id);
      });
  });
};

/**
 * Get a coach's ref from their username.
 * @param {String} username The username of the coach to get the ref for.
 */
const getCoachRef = function getCoachRefFromUsername(username) {
  return new Promise((resolve, reject) => {
    const plainUsername = username.replace('/u/', '');
    Coach.findOne({ username: plainUsername })
      .catch(reject)
      .then((coach) => {
        if (!coach) {
          console.error(`Coach ${plainUsername} not found in database.`);
          resolve('placeholder');
        } else {
          resolve(coach._id);
        }
      });
  });
};

/**
 * Fill refs for plays.
 * @param {Array} plays The array of plays to fill refs for.
 */
const fillPlayRefs = async function fillPlayCoachRefs(plays) {
  const coaches = [];
  for (let i = 0; i < plays.length; i += 1) {
    console.log(`Doing play ${i}`);
    // console.log(coaches);
    const playPromises = [];
    const play = plays[i];

    playPromises.push(
      new Promise((resolve, reject) => {
        let offCoachRef = false;
        // Check cached coach names
        for (let j = 0; j < coaches.length; j += 1) {
          const coach = coaches[j];
          if (coach.name === play.offense.coach) {
            offCoachRef = coach.ref;
          }
        }
        if (offCoachRef) {
          play.offense.coach = offCoachRef;
          resolve();
        } else {
          getCoachRef(play.offense.coach)
            .catch(reject)
            .then((coachRef) => {
              console.log(`Got coach ref for ${play.offense.coach}: ${coachRef}`);
              coaches.push({ name: play.offense.coach, ref: coachRef });
              play.offense.coach = coachRef;
              resolve();
            });
        }
      }),
    );

    // Check cached coach names
    for (let j = 0; j < play.defense.coach.length; j += 1) {
      playPromises.push(
        new Promise((resolve, reject) => {
          let defCoachRef = false;
          for (let k = 0; k < coaches.length; k += 1) {
            const coach = coaches[k];
            if (coach.name === play.defense.coach[j]) {
              defCoachRef = coach.ref;
            }
          }
          if (defCoachRef) {
            play.defense.coach[j] = defCoachRef;
            resolve();
          } else {
            getCoachRef(play.defense.coach[j])
              .catch(reject)
              .then((coachRef) => {
                console.log(`Got coach ref for ${play.defense.coach[j]}: ${coachRef}`);
                coaches.push({ name: play.defense.coach[j], ref: coachRef });
                play.defense.coach[j] = coachRef;
                resolve();
              });
          }
        }),
      );
    }

    // eslint-disable-next-line no-await-in-loop
    await Promise.all(playPromises)
      .catch((err) => {
        throw new Error(err);
      });
  }
  return plays;
};

/**
 * Add object refs to necessary fields in this game.
 * @param {Object} parsedGame The game to fill refs for
 */
const fillGameRefs = function fillGameRefs(parsedGame) {
  return new Promise((resolve, reject) => {
    const gameObj = parsedGame;
    const promises = [];
    promises.push(
      new Promise((subResolve, subReject) => {
        getTeamRef(gameObj.homeTeam.team)
          .catch(subReject)
          .then((teamRef) => {
            gameObj.homeTeam.team = teamRef;
            subResolve();
          });
      }),
      new Promise((subResolve, subReject) => {
        getTeamRef(gameObj.awayTeam.team)
          .catch(subReject)
          .then((teamRef) => {
            gameObj.awayTeam.team = teamRef;
            subResolve();
          });
      }),
      new Promise((subResolve, subReject) => {
        fillPlayRefs(gameObj.plays)
          .catch(subReject)
          .then((plays) => {
            gameObj.plays = plays;
            subResolve();
          });
      }),
    );
    Promise.all(promises)
      .catch(reject)
      .then(() => resolve(gameObj));
  });
};

const fetchGameInfo = function fetchAndParseGameInfo(gameId) {
  return new Promise((resolve, reject) => {
    reddit.getSubmission(gameId).fetch()
      .catch(reject)
      .then((response) => {
        parseGameJson(response, gameId)
          .catch(reject)
          .then((parsedGame) => {
            fillGameRefs(parsedGame)
              .catch(reject)
              .then(resolve);
          });
      });
  });
};

module.exports = fetchGameInfo;
