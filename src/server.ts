import express from 'express';
import mongoose from 'mongoose';
import compression from 'compression';
import Season from './models/schedules/season.model';
import Week from './models/schedules/week.model';
import weekGames from './weekGames.json';
import { addGame } from './tasks/addGame';
import deleteGame from './tasks/deleteGame';
import fetchGameInfo from './tasks/fetchGameInfo';
import updateGames from './tasks/updateGames';
import setupRoutes from './routes';

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
            mongoose.set('debug', true);
            // eslint-disable-next-line no-await-in-loop
            await deleteGame(currentGame.gameId);
            mongoose.set('debug', false);
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
          .then((gameInfo) => addGame(gameInfo, weekGames.seasonNo, weekGames.weekNo))
          .catch((error) => {
            throw error;
          });
      }
    }

    const app = express();

    app.use(compression());

    app.use((req, res, next) => {
      const origins = ['http://localhost:3000', 'http://localhost:3000/', 'https://1212.one', 'https://1212.one/'];
      console.log(`Origin: ${req.get('origin')}, IP: ${req.headers['x-forwarded-for']}, Path: ${req.path}`);
      if (origins.indexOf(req.get('origin')) >= 0) {
        res.header('Access-Control-Allow-Origin', req.get('origin'));
      }
      return next();
    });

    setupRoutes(app, weekGames.seasonNo);

    const PORT = process.env.PORT || 12121;
    app.listen(PORT, () => {
      console.log(`App is listening to ${PORT}...`);
      console.log(`env: ${app.get('env')}`);
      console.log('Press Ctrl+C to quit.');

      updateGames(weekGames.seasonNo, weekGames.weekNo, true);

      setInterval(() => { updateGames(weekGames.seasonNo, weekGames.weekNo); }, 60000);
    });
  });
