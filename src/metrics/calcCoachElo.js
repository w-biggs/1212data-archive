/* eslint-disable no-await-in-loop */
const mathjs = require('mathjs');
const CoachMetrics = require('../models/coachMetrics.model');
const Week = require('../models/schedules/week.model');
const Game = require('../models/schedules/game.model');

/* Vegas line divisor - (Elo - Opp Elo / x). */
const vegasDivisor = 18.14010981807;

/* MOV Standard Deviation - MOVs' standard deviation from the vegas line */
const movStdev = 15.61;

/* K value */
const kval = 20;

/**
 * Get a coach's elo as of a specific week.
 * @param {Object} coach The coach document.
 * @param {import('mongoose').Document} week The week document, populated.
 */
const getCoachElo = async function getCoachElo(coach, week) {
  // Deleted users get 1500 automatically
  if (coach.username === '[deleted]') {
    return 1500;
  }

  const coachMetrics = await CoachMetrics
    .findOne({ coach: coach._id })
    .populate({
      path: 'weeks.week',
      select: 'weekNo',
      populate: {
        path: 'season',
        select: 'seasonNo',
      },
    })
    .exec();
  let foundWeek = false;
  for (let i = coachMetrics.weeks.length - 1; i >= 0; i -= 1) {
    const metricsWeek = coachMetrics.weeks[i];
    if (metricsWeek.week.equals(week._id)
      || (metricsWeek.week.season.seasonNo <= week.season.seasonNo
        || metricsWeek.week.weekNo <= week.weekNo)
    ) {
      foundWeek = true;
      return metricsWeek.games[metricsWeek.games.length - 1].elo.elo;
    }
  }

  // Didn't play in the previous season.
  if (!foundWeek) {
    return 1500;
  }
  
  console.log(coachMetrics);
  throw new Error(`Could not find S${week.season.seasonNo} W${week.weekNo} metrics for ${coach.username}`);
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
  minsPlayed, coachWinProb, movMultiplier, expectedCoachWinProb,
) {
  /* deweight Elo changes for games with very short lengths */
  const expDeweight = (((1 - Math.exp(0 - (minsPlayed / 2))) * 2) / expNormalizer);

  /* difference between result and expected result */
  const diffFromExpected = coachWinProb - expectedCoachWinProb;

  return expDeweight * movMultiplier * kval * diffFromExpected;
};

/* P-F-R method - see https://www.pro-football-reference.com/about/win_prob.htm */
const calcWinProb = function calculateWinProbability(
  coachScore, oppScore, coachElo, oppElo, minsPlayed,
) {
  const oppMargin = oppScore - coachScore;
  const inverseVegasLine = (coachElo - oppElo) / vegasDivisor;
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
const calcGameCoachElo = async function calcGameCoachElo(gameId) {
  const game = await Game.findById(gameId)
    .populate([{
      path: 'homeTeam.coaches.coach',
    }, {
      path: 'awayTeam.coaches.coach',
    }])
    .exec();
  
  if (!game || game.live) {
    return false;
  }

  /* Cap at 28 for overtime games */
  const mins = Math.min(game.getGameLength() / 60, 28);

  const gameWeek = await Week.findOne({ games: game._id })
    .populate('season', 'seasonNo')
    .exec();

  const homeScore = game.homeTeam.stats.score.final;
  const awayScore = game.awayTeam.stats.score.final;

  const homePlays = game.homeTeam.coaches.reduce((a, b) => a + b.plays, 0);
  let homeElo = 0;
  for (let i = 0; i < game.homeTeam.coaches.length; i += 1) {
    const coach = game.homeTeam.coaches[i];
    if (!coach.coach) {
      console.log(gameId);
    }
    const coachElo = await getCoachElo(coach.coach, gameWeek);
    homeElo += coachElo * (coach.plays / homePlays);
  }

  const awayPlays = game.awayTeam.coaches.reduce((a, b) => a + b.plays, 0);
  let awayElo = 0;
  for (let i = 0; i < game.awayTeam.coaches.length; i += 1) {
    const coach = game.awayTeam.coaches[i];
    const coachElo = await getCoachElo(coach.coach, gameWeek);
    awayElo += coachElo * (coach.plays / awayPlays);
  }

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

  const coaches = [];

  for (let i = 0; i < game.homeTeam.coaches.length; i += 1) {
    const gameCoach = game.homeTeam.coaches[i];
    coaches.push(
      getCoachElo(gameCoach.coach, gameWeek)
        .then((prev) => {
          const change = homeEloChange * (gameCoach.plays / homePlays);
          return {
            game,
            coach: gameCoach.coach,
            oppElo: awayElo,
            oldElo: prev,
            elo: prev + change,
          };
        }),
    );
  }

  for (let i = 0; i < game.awayTeam.coaches.length; i += 1) {
    const gameCoach = game.awayTeam.coaches[i];
    coaches.push(
      getCoachElo(gameCoach.coach, gameWeek)
        .then((prev) => {
          const change = awayEloChange * (gameCoach.plays / awayPlays);
          return {
            game,
            coach: gameCoach.coach,
            oppElo: homeElo,
            oldElo: prev,
            elo: prev + change,
          };
        }),
    );
  }

  return Promise.all(coaches);
};

module.exports = {
  getCoachElo,
  calcGameCoachElo,
};
