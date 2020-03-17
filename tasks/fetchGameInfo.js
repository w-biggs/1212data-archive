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
    const teamInfoRegex = /Defense\n.*\n\[(.+)\].+\|(\/u\/.+)\|(.+)\|(.+)\n\[(.+)\].+\|(\/u\/.+)\|(.+)\|(.+)/gm;
    const teamInfoMatch = teamInfoRegex.exec(postBody);
    const [, awayTeamName, awayCoach, awayOffense, awayDefense,
      homeTeamName, homeCoach, homeOffense, homeDefense] = teamInfoMatch;
  
    const homeTeam = {
      offense: homeOffense,
      defense: homeDefense,
      team: homeTeamName,
      coach: homeCoach.split(' and '),
    };
    const awayTeam = {
      offense: awayOffense,
      defense: awayDefense,
      team: awayTeamName,
      coach: awayCoach.split(' and '),
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
          const newCoach = new Coach({ username: plainUsername });
          newCoach.save()
            .catch(reject)
            .then(savedCoach => resolve(savedCoach._id));
        } else {
          resolve(coach._id);
        }
      });
  });
};

const fillCoachRef = function fillCoachRef(coach, cachedCoaches) {
  return new Promise((resolve, reject) => {
    let coachRef = false;
  
    // Check cached coach names
    for (let i = 0; i < cachedCoaches.length; i += 1) {
      const cachedCoach = cachedCoaches[i];
      if (coach === cachedCoach.name) {
        coachRef = cachedCoach.ref;
      }
    }

    if (coachRef !== false) {
      resolve({
        ref: coachRef,
        push: false,
      });
    } else {
      getCoachRef(coach)
        .catch(reject)
        .then((newRef) => {
          console.log(`Got coach ref for ${coach}: ${newRef}`);
          resolve({
            ref: newRef,
            push: true,
          });
        });
    }
  });
};

/**
 * Fill refs for plays.
 * @param {Array} plays The array of plays to fill refs for.
 */
const fillPlayRefs = async function fillPlayCoachRefs(plays) {
  const coaches = [];
  const filledPlays = [];
  for (let i = 0; i < plays.length; i += 1) {
    console.log(`Doing play ${i}`);
    const play = plays[i];

    /**
     * Offense coach
     */
    // eslint-disable-next-line no-await-in-loop
    const offRef = await fillCoachRef(play.offense.coach, coaches);
    if (offRef.push) {
      coaches.push({ name: play.offense.coach, ref: offRef.ref });
    }
    play.offense.coach = offRef.ref;

    /**
     * Defense coach(es)
     */
    for (let j = 0; j < play.defense.coach.length; j += 1) {
      // eslint-disable-next-line no-await-in-loop
      const defRef = await fillCoachRef(play.defense.coach[j], coaches);
      if (defRef.push) {
        coaches.push({ name: play.defense.coach[j], ref: defRef.ref });
      }
      play.defense.coach[j] = defRef.ref;
    }

    filledPlays.push(play);
  }
  return filledPlays;
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
              .then((result) => {
                const gameObj = result;
                delete gameObj.homeTeam.coach;
                delete gameObj.awayTeam.coach;
                resolve(gameObj);
              });
          });
      });
  });
};

module.exports = fetchGameInfo;
