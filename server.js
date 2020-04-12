const express = require('express');
const mongoose = require('mongoose');
const compression = require('compression');
const fs = require('fs');
const Season = require('./models/schedules/season.model');
const Week = require('./models/schedules/week.model');
const weekGames = require('./weekGames.json');
const { addGame } = require('./tasks/addGame');
const fetchGameInfo = require('./tasks/fetchGameInfo');
const updateGames = require('./tasks/updateGames');
const Game = require('./models/schedules/game.model');
const TeamMetrics = require('./models/teamMetrics.model');
const Team = require('./models/teams/team.model');
const CoachMetrics = require('./models/coachMetrics.model');
const Coach = require('./models/coach.model');
const Division = require('./models/teams/division.model');
const Conference = require('./models/teams/conference.model');
const Play = require('./models/play.model');
// const addOldGames = require('./old_data/oldGames');
// const checkModifiedGames = require('./old_data/checkModifiedGames');

// eslint-disable-next-line no-unused-vars
const writeDebug = function writeDebug(data) {
  fs.writeFile('debug.json', JSON.stringify(data, null, 2), (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log('Successfully wrote debug.json.');
    }
  });
};

/* Connect to MongoDB */
mongoose.connect('mongodb://127.0.0.1:27017/1212', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
})
  .catch(console.error)
  .then(async () => {
    const setWeekGames = true;
    if (setWeekGames) {
      const currentSeason = await Season.findOne({ seasonNo: weekGames.seasonNo }).exec();
      const currentWeek = await Week.findOne({
        season: currentSeason._id,
        weekNo: weekGames.weekNo,
      })
        .populate('games')
        .exec();

      if (currentWeek) {
        for (let i = 0; i < currentWeek.games.length; i += 1) {
          const currentGame = currentWeek.games[i];
          const gamePos = weekGames.games.indexOf(currentGame.gameId);
          if (gamePos < 0) {
            console.log(`${currentGame.gameId} no longer in weekGames, deleting.`);
            // eslint-disable-next-line no-await-in-loop
            await Game.deleteOne({ _id: currentGame._id });
            // eslint-disable-next-line no-await-in-loop
            await Week.updateOne({ _id: currentWeek._id }, { $pull: { games: currentGame._id } });
          } else {
            // Game already exists
            weekGames.games.splice(gamePos, 1);
          }
        }
      }

      // Add the week's games
      for (let i = 0; i < weekGames.games.length; i += 1) {
        const weekGame = weekGames.games[i];
        // eslint-disable-next-line no-await-in-loop
        await fetchGameInfo(weekGame)
          .then(gameInfo => addGame(gameInfo, weekGames.seasonNo, weekGames.weekNo))
          .catch((error) => {
            throw error;
          });
      }
    }

    const app = express();

    app.use(compression());

    app.use((req, res, next) => {
      const origins = ['http://localhost:3000', 'http://localhost:3000/', 'https://1212.one', 'https://1212.one/'];
      console.log(`Origin: ${req.headers.origin}, IP: ${req.headers['x-forwarded-for']}`);
      if (origins.indexOf(req.headers.origin) >= 0) {
        res.header('Access-Control-Allow-Origin', req.headers.origin);
      }
      return next();
    });

    app.get('/games/:seasonNo?/:weekNo?/:confName?/', async (req, res) => {
      const { seasonNo, weekNo, confName } = req.params;
      let conf = null;
      if (confName) {
        conf = await Conference.findOne({ shortName: decodeURI(confName) });
        if (!conf) {
          return res.send({ error: 'Conference not found.' });
        }
      }

      if (seasonNo) {
        const season = await Season.findOne({ seasonNo });
        if (season) {
          if (weekNo) {
            const week = await Week.findOne({ season: season._id, weekNo })
              .populate('season', 'seasonNo');
            if (week) {
              week.games = await week.getSortedGames();
              if (conf) {
                const filteredGames = [];
                for (let i = 0; i < week.games.length; i += 1) {
                  const weekGame = week.games[i];
    
                  const homeDiv = weekGame.homeTeam.team.division[seasonNo - 1];
                  const homeConf = homeDiv ? homeDiv.conference.shortName : null;
    
                  const awayDiv = weekGame.awayTeam.team.division[seasonNo - 1];
                  const awayConf = awayDiv ? awayDiv.conference.shortName : null;
    
                  if (!homeDiv) {
                    console.log(weekGame.homeTeam.team.name);
                  }
                  if (!awayDiv) {
                    console.log(weekGame.awayTeam.team.name);
                  }
    
                  if (awayConf === confName || homeConf === confName) {
                    filteredGames.push(weekGame);
                  }
                }
                week.games = filteredGames;
              }
              return res.send(week);
            }
            return res.send({ error: 'Week not found.' });
          }
          // No week given
          return res.send({ error: 'A week must be given if a season is requested.' });
        }
        return res.send({ error: 'Season not found.' });
      }

      // No season given
      const games = await Game.find().lean().exec();
      games.sort((a, b) => a.startTime - b.startTime);
      return res.send(games);
    });

    app.get('/seasons/', async (req, res) => {
      const seasons = await Season.find()
        .lean()
        .select('-_id')
        .populate({
          path: 'weeks',
          select: 'weekNo weekName -_id',
        });
      res.send(seasons);
    });

    app.get('/confs/', async (req, res) => {
      const confs = await Conference.find()
        .lean()
        .select('name shortName -_id');
      res.send(confs);
    });

    app.get('/metrics/', async (req, res) => {
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
        }])
        .exec();
      const findTime = process.hrtime(startTime);
      console.log(`${findTime[0]}s ${findTime[1] / 1e6}ms`);
      const metrics = {
        teams: teamMetrics,
        ranges,
      };
      res.send(metrics);
    });

    app.get('/coachMetrics/', async (req, res) => {
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
    });

    app.get('/plays/coach/:username/', async (req, res) => {
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
      const filteredPlays = plays.filter(play => play.game !== null);
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
    });

    const PORT = process.env.PORT || 12121;
    app.listen(PORT, () => {
      console.log(`App is listening to ${PORT}...`);
      console.log(`env: ${app.get('env')}`);
      console.log('Press Ctrl+C to quit.');

      updateGames(weekGames.seasonNo, weekGames.weekNo, true);

      setInterval(updateGames, 60000, weekGames.seasonNo, weekGames.weekNo);
    });
  });
