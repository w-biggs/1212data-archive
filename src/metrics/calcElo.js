/* eslint-disable no-await-in-loop */
const mathjs = require('mathjs');
const TeamMetrics = require('../models/teamMetrics.model');
const Season = require('../models/schedules/season.model');
const Week = require('../models/schedules/week.model');
const Game = require('../models/schedules/game.model');
const Team = require('../models/teams/team.model');

/* Vegas line divisor - (Elo - Opp Elo / x). */
const vegasDivisor = 18.14010981807;

/* MOV Standard Deviation - MOVs' standard deviation from the vegas line */
const movStdev = 15.61;

/* K value */
const kval = 20;

/**
 * Get a team's elo as of a specific week.
 * @param {import('mongoose').Document} team The team document.
 * @param {Number} weekNo The week number. Null for preseason.
 * @param {import('mongoose').Document} season The season document.
 */
const getElo = async function getTeamElo(team, weekNo, season) {
  if (!season) {
    return 1500;
  }
  const teamMetrics = await TeamMetrics.findOne({ team: team._id }).exec();
  let foundSeason = false;
  for (let i = 0; i < teamMetrics.seasons.length; i += 1) {
    const metricsSeason = teamMetrics.seasons[i];
    if (metricsSeason.season.equals(season._id)) {
      foundSeason = true;
      for (let j = metricsSeason.weeks.length - 1; j >= 0; j -= 1) {
        const metricsWeek = metricsSeason.weeks[j];
        if (typeof metricsWeek.week === 'undefined') {
          return metricsWeek.elo.elo;
        }
        if (weekNo !== null) {
          const metricsWeekDoc = await Week.findById(metricsWeek.week).exec();
          if (metricsWeekDoc.weekNo <= weekNo) {
            return metricsWeek.elo.elo;
          }
        }
      }
    }
  }

  // Didn't play in the previous season.
  if (!foundSeason) {
    return 1500;
  }
  
  console.log(teamMetrics);
  throw new Error(`Could not find S${season ? season.seasonNo : '--'} W${weekNo || '--'} metrics for ${team.name}`);
};

const cdfNormal = function normalCumulativeDistributionFunction(x, mean, stdev) {
  return (1 - mathjs.erf((mean - x) / (Math.sqrt(2) * stdev))) / 2;
};

const calcMovMultiplier = function calculateMarginOfVictoryMultiplier(scoreDiff, winnerEloDiff) {
  return Math.log(Math.abs(scoreDiff) + 1) * (2.2 / ((winnerEloDiff * 0.001) + 2.2));
};

/* don't calculate this every time */
const expNormalizer = (1 - Math.exp(0 - (28 / 2))) * 2;

const calcEloChange = function calculateEloChange(
  minsPlayed, teamWinProb, movMultiplier, expectedTeamWinProb,
) {
  /* deweight Elo changes for games with very short lengths */
  const expDeweight = (((1 - Math.exp(0 - (minsPlayed / 2))) * 2) / expNormalizer);

  /* difference between result and expected result */
  const diffFromExpected = teamWinProb - expectedTeamWinProb;

  return expDeweight * movMultiplier * kval * diffFromExpected;
};

/* P-F-R method - see https://www.pro-football-reference.com/about/win_prob.htm */
const calcWinProb = function calculateWinProbability(
  teamScore, oppScore, teamElo, oppElo, minsPlayed,
) {
  const oppMargin = oppScore - teamScore;
  const inverseVegasLine = (teamElo - oppElo) / vegasDivisor;
  const minsRemaining = (28 - minsPlayed);

  const winDist = cdfNormal((oppMargin + 0.5),
    (inverseVegasLine * (minsRemaining / 28)),
    (movStdev / Math.sqrt(28 / minsRemaining)));

  const lossDist = cdfNormal((oppMargin - 0.5),
    (inverseVegasLine * (minsRemaining / 28)),
    (movStdev / Math.sqrt(28 / minsRemaining)));

  const winProb = ((1 - winDist) + (0.5 * (winDist - lossDist)));

  return winProb;
};

/**
 * Calculate a game's Elo results
 * @param {import('mongoose').Schema.Types.ObjectId} gameId The game's Object ID
 */
const calcGameElo = async function calcGameElo(gameId) {
  const game = await Game.findById(gameId).exec();
  if (!game || game.live) {
    return false;
  }

  /* Cap at 28 for overtime games */
  const mins = Math.min(game.getGameLength() / 60, 28);

  const homeTeam = await Team.findById(game.homeTeam.team).exec();
  const awayTeam = await Team.findById(game.awayTeam.team).exec();

  const gameWeek = await Week.findOne({ games: game._id }).exec();
  const gameSeason = await Season.findById(gameWeek.season).exec();

  const homeScore = game.homeTeam.stats.score.final;
  const awayScore = game.awayTeam.stats.score.final;
  
  const homeElo = await getElo(homeTeam, gameWeek.weekNo - 1, gameSeason);
  const awayElo = await getElo(awayTeam, gameWeek.weekNo - 1, gameSeason);

  let winnerEloDiff = 0;

  if (homeScore > awayScore) {
    winnerEloDiff = homeElo - awayElo;
  } else if (awayScore > homeScore) {
    winnerEloDiff = awayElo - homeElo;
  }

  const homeWinProb = calcWinProb(homeScore, awayScore, homeElo, awayElo, mins);

  const movMultiplier = calcMovMultiplier(homeScore - awayScore, winnerEloDiff);

  /* 0 score diff and 0 minutes played = pre-game odds */
  const expectedHomeWinProb = calcWinProb(0, 0, homeElo, awayElo, 0);

  const homeEloChange = calcEloChange(mins, homeWinProb, movMultiplier, expectedHomeWinProb);

  const awayEloChange = 0 - homeEloChange;

  const newHomeElo = homeElo + homeEloChange;

  const newAwayElo = awayElo + awayEloChange;

  return {
    game,
    homeTeam,
    awayTeam,
    homeElo: {
      oppElo: awayElo,
      oldElo: homeElo,
      elo: newHomeElo,
    },
    awayElo: {
      oppElo: homeElo,
      oldElo: awayElo,
      elo: newAwayElo,
    },
  };
};

module.exports = {
  getElo,
  calcGameElo,
};
