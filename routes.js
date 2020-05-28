/**
 * Express routes
 */
// Tasks
const compileStandings = require('./tasks/standings');
const TeamStats = require('./tasks/TeamStats');
const updateMetrics = require('./metrics/updateMetrics');

// Models
const Season = require('./models/schedules/season.model');
const Week = require('./models/schedules/week.model');
const Conference = require('./models/teams/conference.model');
const Division = require('./models/teams/division.model');
const Team = require('./models/teams/team.model');
const Game = require('./models/schedules/game.model');
const TeamMetrics = require('./models/teamMetrics.model');
const CoachMetrics = require('./models/coachMetrics.model');
const Coach = require('./models/coach.model');
const Play = require('./models/play.model');

/**
 * Route for /games/:seasonNo?/:weekNo?/:confName?/
 * @param {import('express').Request} req The request.
 * @param {import('express').Response} res The response.
 */
const gamesRoute = async function gamesRoute(req, res) {
  const { seasonNo, weekNo, confName } = req.params;

  // If a season number was given
  if (seasonNo) {
    const season = await Season.findOne({ seasonNo }).lean();
    if (!season) {
      return res.send({ error: 'Season not found.' });
    }
    if (weekNo) {
      const week = await Week.findOne({ season: season._id, weekNo });
      if (!week) {
        return res.send({ error: 'Week not found.' });
      }
      week.games = await week.getSortedGames();
      if (confName) {
        const conf = await Conference.findOne({ shortName: decodeURI(confName) }).lean();
        if (!conf) {
          return res.send({ error: 'Conference not found.' });
        }
        week.games = week.games.filter((game) => {
          const homeDiv = game.homeTeam.team.division[seasonNo - 1];
          const homeConf = homeDiv ? homeDiv.conference.shortName : null;

          const awayDiv = game.awayTeam.team.division[seasonNo - 1];
          const awayConf = awayDiv ? awayDiv.conference.shortName : null;

          return (awayConf === confName || homeConf === confName);
        });
      }
      return res.send(week);
    }

    // No week was given
    const seasonWeeks = await Week.find({ season: season._id });
    const sortedWeekFetches = [];
    for (let i = 0; i < seasonWeeks.length; i += 1) {
      sortedWeekFetches.push(seasonWeeks[i].getSortedGames());
    }
    const sortedWeekGames = await Promise.all(sortedWeekFetches);
    let seasonGames = [];
    for (let i = 0; i < sortedWeekGames.length; i += 1) {
      const filteredGames = sortedWeekGames[i].filter((game) => !game.live);
      seasonGames = seasonGames.concat(filteredGames);
    }
    return res.send({
      ...season,
      seasonGames,
    });
  }

  // No season was given
  const games = await Game.find().lean();
  games.sort((a, b) => a.startTime - b.startTime);
  return res.send(games);
};

/**
 * Route for /seasons/
 * @param {import('express').Request} req The request.
 * @param {import('express').Response} res The response.
 */
const seasonsRoute = async function seasonsRoute(req, res) {
  const seasons = await Season.find()
    .lean()
    .select('-_id')
    .populate({
      path: 'weeks',
      select: 'weekNo weekName -_id',
    });
  res.send(seasons);
};

/**
 * Route for /confs/
 * @param {import('express').Request} req The request.
 * @param {import('express').Response} res The response.
 */
const confsRoute = async function confsRoute(req, res) {
  const confs = await Conference.find()
    .lean()
    .select('name shortName -_id');
  res.send(confs);
};

/**
 * Route for /standings/:seasonNo?/
 * @param {Number} currentSeasonNo The current season number.
 * @param {import('express').Request} req The request.
 * @param {import('express').Response} res The response.
 */
const standingsRoute = async function standingsRoute(currentSeasonNo, req, res) {
  let { seasonNo } = req.params;
  if (!seasonNo) {
    seasonNo = currentSeasonNo;
  }
  const standings = await compileStandings(seasonNo);
  res.send(standings);
};

/**
 * Route for /stats/:seasonNo/
 * @param {import('express').Request} req The request.
 * @param {import('express').Response} res The response.
 */
const statsRoute = async function statsRoute(req, res) {
  const { seasonNo } = req.params;
  const season = await Season.findOne({ seasonNo });
  const seasonWeeks = await Week.find({ season: season._id, weekNo: { $lte: 13 } });
  const sortedWeekFetches = [];
  for (let i = 0; i < seasonWeeks.length; i += 1) {
    sortedWeekFetches.push(seasonWeeks[i].getSortedGames());
  }
  const sortedWeekGames = await Promise.all(sortedWeekFetches);
  // Iterate thru games and get stats
  const teamsStats = [];
  for (let i = 0; i < sortedWeekGames.length; i += 1) {
    const games = sortedWeekGames[i];
    for (let j = 0; j < games.length; j += 1) {
      const game = games[j];
      if (!game.live) {
        const homeTeamIndex = teamsStats.findIndex((team) => team.name === game.homeTeam.team.name);
        if (homeTeamIndex < 0) {
          const teamStats = new TeamStats(game.homeTeam.team.name);
          teamStats.addGame(game.homeTeam.stats, game.awayTeam.stats, game.awayTeam.team.name);
          teamsStats.push(teamStats);
        } else {
          teamsStats[homeTeamIndex].addGame(
            game.homeTeam.stats, game.awayTeam.stats, game.awayTeam.team.name,
          );
        }
        const awayTeamIndex = teamsStats.findIndex((team) => team.name === game.awayTeam.team.name);
        if (awayTeamIndex < 0) {
          const teamStats = new TeamStats(game.awayTeam.team.name);
          teamStats.addGame(game.awayTeam.stats, game.homeTeam.stats, game.homeTeam.team.name);
          teamsStats.push(teamStats);
        } else {
          teamsStats[awayTeamIndex].addGame(
            game.awayTeam.stats, game.homeTeam.stats, game.homeTeam.team.name,
          );
        }
      }
    }
  }
  // SoS
  for (let i = 0; i < teamsStats.length; i += 1) {
    const teamStats = teamsStats[i];
    teamStats.calcSOS(teamsStats);
  }
  teamsStats.sort((a, b) => a.name.localeCompare(b.name));
  res.send(teamsStats);
};

/**
 * Route for /metrics/
 * @param {import('express').Request} req The request.
 * @param {import('express').Response} res The response.
 */
const metricsRoute = async function metricsRoute(req, res) {
  const { sheets } = req.params;
  const startTime = process.hrtime();
  const ranges = await TeamMetrics.getRanges();
  const teamMetrics = await TeamMetrics.find()
    .lean()
    .select('-_id')
    .populate([{
      path: 'team',
      select: '-_id',
      populate: {
        path: 'division',
        model: Division,
        select: 'name conference -_id',
        populate: {
          path: 'conference',
          model: Conference,
          select: 'name -_id',
        },
      },
    }, {
      path: 'seasons.season',
      model: Season,
      select: 'seasonNo -_id',
    }, {
      path: 'seasons.weeks.week',
      model: Week,
      select: 'weekNo -_id',
    }, {
      path: 'seasons.weeks.game',
      model: Game,
      select: 'homeTeam.team awayTeam.team homeTeam.stats.score awayTeam.stats.score -_id',
      populate: [{
        path: 'homeTeam.team',
        model: Team,
        select: 'name -_id',
      }, {
        path: 'awayTeam.team',
        model: Team,
        select: 'name -_id',
      }],
    }]);
  if (sheets === 'sheets') {
    const csv = [['Team Name', 'Elo', 'wP-N']];
    for (let i = 0; i < teamMetrics.length; i += 1) {
      const teamMetric = teamMetrics[i];
      const latestSeason = teamMetric.seasons[teamMetric.seasons.length - 1];
      const latestWeek = latestSeason.weeks[latestSeason.weeks.length - 1];
      csv.push([teamMetric.team.name, latestWeek.elo.elo, latestSeason.wPN]);
    }
    res.send(csv.map((row) => row.join(',')).join('\n'));
  } else {
    const metrics = {
      teams: teamMetrics,
      ranges,
    };
    const findTime = process.hrtime(startTime);
    metrics.fetchTime = `${findTime[0]}s ${findTime[1] / 1e6}ms`;
    res.send(metrics);
  }
};

/**
 * Route for /coach-metrics/
 * @param {import('express').Request} req The request.
 * @param {import('express').Response} res The response.
 */
const coachMetricsRoute = async function coachMetricsRoute(req, res) {
  const startTime = process.hrtime();
  const ranges = await CoachMetrics.getRanges();
  const coachMetrics = await CoachMetrics.find()
    .lean()
    .select('-_id')
    .populate([{
      path: 'coach',
      select: '-_id',
    }, {
      path: 'weeks.week',
      model: Week,
      select: 'weekNo season -_id',
      populate: {
        path: 'season',
        model: Season,
        select: 'seasonNo -_id',
      },
    }, {
      path: 'weeks.games.game',
      model: Game,
      select: 'gameId homeTeam.team awayTeam.team homeTeam.coaches awayTeam.coaches homeTeam.stats.score awayTeam.stats.score -_id',
      populate: [{
        path: 'homeTeam.team',
        model: Team,
        select: 'name abbreviation -_id',
      }, {
        path: 'awayTeam.team',
        model: Team,
        select: 'name abbreviation -_id',
      }, {
        path: 'homeTeam.coaches.coach',
        model: Coach,
        select: 'username -_id',
      }, {
        path: 'awayTeam.coaches.coach',
        model: Coach,
        select: 'username -_id',
      }],
    }])
    .exec();
  const findTime = process.hrtime(startTime);
  console.log(`${findTime[0]}s ${findTime[1] / 1e6}ms`);
  const metrics = {
    coaches: coachMetrics,
    ranges,
  };
  res.send(metrics);
};

/**
 * Route for /calc-metrics/:seasonNo/:weekNo/
 * @param {import('express').Request} req The request.
 * @param {import('express').Response} res The response.
 */
const calcMetricsRoute = async function calcMetricsRoute(req, res) {
  const { seasonNo, weekNo } = req.params;
  const startTime = process.hrtime();
  try {
    await updateMetrics(seasonNo, weekNo);
    const updateTime = process.hrtime(startTime);
    res.send(`Updated in ${updateTime[0]}s ${updateTime[1] / 1e6}ms`);
  } catch (error) {
    res.send(error);
  }
};

/**
 * Route for /plays/coach/:username/
 * @param {import('express').Request} req The request.
 * @param {import('express').Response} res The response.
 */
const coachPlaysRoute = async function coachPlaysRoute(req, res) {
  const { username } = req.params;
  const coach = await Coach.findOne({ username }).exec();
  const plays = await Play.find({ $or: [{ 'defense.coach': coach._id }, { 'offense.coach': coach._id }] })
    .lean()
    .populate([{
      path: 'defense.coach',
      select: 'username',
    }, {
      path: 'offense.coach',
      select: 'username',
    }, {
      path: 'game',
      select: 'gameId startTime',
    }]);
  for (let i = 0; i < plays.length; i += 1) {
    plays[i].coachIsOffense = (plays[i].offense.coach.username === username);
  }
  const filteredPlays = plays.filter((play) => play.game !== null);
  filteredPlays.sort((a, b) => {
    const gameComparison = a.game.startTime - b.game.startTime;
    if (gameComparison !== 0) {
      return gameComparison;
    }
  
    const aClock = (a.quarter * 420) + (420 - a.clock);
    const bClock = (b.quarter * 420) + (420 - b.clock);
  
    return aClock - bClock;
  });
  res.send(filteredPlays);
};

/**
 * Sets up the express routes.
 * @param {import('express').Express} app The express instance.
 * @param {Number} currentSeasonNo The current season number.
 */
const setupRoutes = function setupExpressRoutes(app, currentSeasonNo) {
  app.get('/games/:seasonNo?/:weekNo?/:confName?/', gamesRoute);
  app.get('/seasons/', seasonsRoute);
  app.get('/confs/', confsRoute);
  app.get('/standings/:seasonNo?/', standingsRoute.bind(null, currentSeasonNo));
  app.get('/stats/:seasonNo/', statsRoute);
  app.get('/metrics/:sheets?/', metricsRoute);
  app.get('/coachMetrics/', coachMetricsRoute);
  app.get('/calc-metrics/:seasonNo/:weekNo/', calcMetricsRoute);
  app.get('/plays/coach/:username/', coachPlaysRoute);
};

module.exports = setupRoutes;
