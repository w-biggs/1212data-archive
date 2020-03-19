/**
 * Gets the game's info from Reddit and outputs the data needed for the database
 */
const Snoowrap = require('snoowrap');
const Team = require('../models/teams/team.model');
const Coach = require('../models/coach.model');
const config = require('../.config');
const fetchGamePlays = require('./fetchGamePlays');

const reddit = new Snoowrap(config);

const getCoachesFromComments = function getCoachesFromComments(gameJson) {
  const teamCoaches = [];
  for (let i = 0; i < gameJson.comments.length; i += 1) {
    const comment = gameJson.comments[i];
    if (comment.body.indexOf('has submitted') >= 0) {
      const teamNameRegex = /number\. (.+) you're up/gm;
      const teamNameMatch = teamNameRegex.exec(comment.body);
      const teamName = teamNameMatch[1];
  
      const coachRegex = /(\/u\/.+) reply/gm;
      const coachMatch = coachRegex.exec(comment.body);
      const coaches = coachMatch[1].split(' and ');
      
      let foundTeam = false;
      for (let j = 0; j < teamCoaches.length; j += 1) {
        const teamCoach = teamCoaches[j];
        if (teamCoach.team === teamName) {
          foundTeam = true;
          for (let k = 0; k < coaches.length; k += 1) {
            if (!teamCoach.coach.includes('coach')) {
              teamCoach.coach.push(coaches[k]);
            }
          }
        }
      }
      if (!foundTeam) {
        teamCoaches.push({
          team: teamName,
          coach: coaches,
        });
      }
    }
  }
  return teamCoaches;
};

/**
 * Get stats from the game
 * @param {String} postBody The post's body
 */
const parseGameStats = function parseGameStats(postBody) {
  const homeStats = {
    passYds: 0,
    rushYds: 0,
    interceptions: 0,
    fumbles: 0,
    fieldGoals: {
      attempts: 0,
      makes: 0,
    },
    timeOfPossession: 0,
    timeoutsRemaining: 3,
    score: {
      quarters: [],
      final: 0,
    },
  };
  let homeMins = 0;
  let homeSecs = 0;
  const awayStats = {
    passYds: 0,
    rushYds: 0,
    interceptions: 0,
    fumbles: 0,
    fieldGoals: {
      attempts: 0,
      makes: 0,
    },
    timeOfPossession: 0,
    timeoutsRemaining: 3,
    score: {
      quarters: [],
      final: 0,
    },
  };
  let awayMins = 0;
  let awaySecs = 0;

  const statsRegex = /:-:\n([0-9]+) yards\|([0-9]+) yards\|.+\|([0-9]+)\|([0-9]+)\|([0-9]+)\/([0-9]+)\|([0-9]+):([0-9]+)\|([0-9]+)/g;
  const awayStatsMatch = statsRegex.exec(postBody);
  const homeStatsMatch = statsRegex.exec(postBody);

  [, awayStats.passYds, awayStats.rushYds, awayStats.interceptions, awayStats.fumbles,
    awayStats.fieldGoals.makes, awayStats.fieldGoals.attempts, awayMins, awaySecs,
    awayStats.timeoutsRemaining] = awayStatsMatch;
  awayStats.timeOfPossession = (parseInt(awayMins, 10) * 60) + parseInt(awaySecs, 10);

  [, homeStats.passYds, homeStats.rushYds, homeStats.interceptions, homeStats.fumbles,
    homeStats.fieldGoals.makes, homeStats.fieldGoals.attempts, homeMins, homeSecs,
    homeStats.timeoutsRemaining] = homeStatsMatch;
  homeStats.timeOfPossession = (parseInt(homeMins, 10) * 60) + parseInt(homeSecs, 10);

  const scoreRegex = /\|([0-9|]+)\|\*\*([0-9]+)/g;
  const homeScoreMatch = scoreRegex.exec(postBody);
  const awayScoreMatch = scoreRegex.exec(postBody);
  homeStats.score.quarters = homeScoreMatch[1].split('|').map(q => parseInt(q, 10));
  homeStats.score.final = parseInt(homeScoreMatch[2], 10);
  awayStats.score.quarters = awayScoreMatch[1].split('|').map(q => parseInt(q, 10));
  awayStats.score.final = parseInt(awayScoreMatch[2], 10);

  return {
    homeStats,
    awayStats,
  };
};

const parseGameJson = function parseGameJson(gameJson, gameId) {
  return new Promise((resolve, reject) => {
    const postBody = gameJson.selftext;

    const gameObj = {
      gameId,
      startTime: gameJson.created,
      endTime: gameJson.edited,
      homeTeam: {
        team: '',
        coach: [],
        stats: {
          passYds: 0,
          rushYds: 0,
          interceptions: 0,
          fumbles: 0,
          fieldGoals: {
            attempts: 0,
            makes: 0,
          },
          timeOfPossession: 0,
          timeoutsRemaining: 3,
          score: [],
        },
      },
      awayTeam: {
        team: '',
        coach: [],
        stats: {
          passYds: 0,
          rushYds: 0,
          interceptions: 0,
          fumbles: 0,
          fieldGoals: {
            attempts: 0,
            makes: 0,
          },
          timeOfPossession: 0,
          timeoutsRemaining: 3,
          score: [],
        },
      },
      plays: [],
      live: !(postBody.indexOf('Game complete') >= 0),
    };
  
    /**
     * Benchmarked this - multiple small regexes is twice as fast.
     */
    const teamInfoRegex = /Defense\n.*\n\[(.+)\].+\|(\/u\/.+)\|(.+)\|(.+)\n\[(.+)\].+\|(\/u\/.+)\|(.+)\|(.+)/gm;
    const teamInfoMatch = teamInfoRegex.exec(postBody);
    if (teamInfoMatch) {
      [, gameObj.awayTeam.team, gameObj.awayTeam.coach,
        gameObj.awayTeam.offense, gameObj.awayTeam.defense,
        gameObj.homeTeam.team, gameObj.homeTeam.coach,
        gameObj.homeTeam.offense, gameObj.homeTeam.defense] = teamInfoMatch;

      gameObj.homeTeam.coach = gameObj.homeTeam.coach.split(' and ');
      gameObj.awayTeam.coach = gameObj.awayTeam.coach.split(' and ');
    } else {
      const oldTeamInfoRegex = /\[GAME THREAD\].+?\) (.+) @ .+?\) (.+)/;
      const oldTeamInfoMatch = oldTeamInfoRegex.exec(gameJson.title);
      [, gameObj.awayTeam.team, gameObj.homeTeam.team] = oldTeamInfoMatch;

      const teamCoaches = getCoachesFromComments(gameJson);
      for (let i = 0; i < teamCoaches.length; i += 1) {
        const teamCoach = teamCoaches[i];
        if (teamCoach.team === gameObj.awayTeam.team) {
          gameObj.awayTeam.coach = teamCoach.coach;
        } else if (teamCoach.team === gameObj.homeTeam.team) {
          gameObj.homeTeam.coach = teamCoach.coach;
        }
      }
    }
  
    let playsLink = '';
    const playsLinkRegex = /\[Plays\]\((.+)\)/gm;
    const playsLinkMatch = playsLinkRegex.exec(postBody);
    if (playsLinkMatch) {
      [, playsLink] = playsLinkMatch;
    }

    const gameStats = parseGameStats(postBody);
    gameObj.homeTeam.stats = gameStats.homeStats;
    gameObj.awayTeam.stats = gameStats.awayStats;

    fetchGamePlays(playsLink, gameId, reddit, gameObj.homeTeam, gameObj.awayTeam)
      .catch(reject)
      .then((plays) => {
        gameObj.plays = plays;
        resolve(gameObj);
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
  if (plays) {
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
  }
  return null;
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
