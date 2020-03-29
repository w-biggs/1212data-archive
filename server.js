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
const Division = require('./models/teams/division.model');
const Conference = require('./models/teams/conference.model');
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
      console.log(req.headers.origin);
      if (origins.indexOf(req.headers.origin) >= 0) {
        res.header('Access-Control-Allow-Origin', req.headers.origin);
      }
      return next();
    });

    app.get('/games/:seasonNo/:weekNo/', async (req, res) => {
      const { seasonNo, weekNo } = req.params;
      const season = await Season.findOne({ seasonNo });
      if (season) {
        const week = await Week.findOne({ season: season._id, weekNo }).populate('season');
        if (week) {
          week.games = await week.getSortedGames();
          res.send(week);
        } else {
          res.send({ error: 'Week not found.' });
        }
      } else {
        res.send({ error: 'Season not found.' });
      }
    });

    app.get('/metrics/', async (req, res) => {
      const startTime = process.hrtime();
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
      res.send(teamMetrics);
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
