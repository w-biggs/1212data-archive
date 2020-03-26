const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const Season = require('./models/schedules/season.model');
const Week = require('./models/schedules/week.model');
const weekGames = require('./weekGames.json');
const { addGame } = require('./tasks/addGame');
const fetchGameInfo = require('./tasks/fetchGameInfo');
const updateGames = require('./tasks/updateGames');
const Game = require('./models/schedules/game.model');
// const Team = require('./models/teams/team.model');
// const Division = require('./models/teams/division.model');
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
    const addWeekGames = false;
    if (addWeekGames) {
      // Add the week's games
      for (let i = 0; i < weekGames.games.length; i += 1) {
        const weekGame = weekGames.games[i];
        // eslint-disable-next-line no-await-in-loop
        await Game.findOne({ gameId: weekGame })
          .then((game) => {
            if (game) {
              return console.log(`${weekGame} already exists, skipping...`);
            }
            return fetchGameInfo(weekGame)
              .then(gameInfo => addGame(gameInfo, weekGames.seasonNo, weekGames.weekNo))
              .catch((error) => {
                throw error;
              });
          });
      }
    }

    const app = express();

    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', 'http://localhost:3000/');
      next();
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

    const PORT = process.env.PORT || 1212;
    app.listen(PORT, () => {
      console.log(`App is listening to ${PORT}...`);
      console.log(`env: ${app.get('env')}`);
      console.log('Press Ctrl+C to quit.');

      updateGames(weekGames.seasonNo, weekGames.weekNo);

      setInterval(updateGames, 60000, weekGames.seasonNo, weekGames.weekNo);
    });
  });
