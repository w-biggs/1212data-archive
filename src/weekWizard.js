/**
 * Streamlines adding a new week and its games.
 */
const fs = require('fs');
const readline = require('readline');
const bent = require('bent');
const mongoose = require('mongoose');
const Team = require('./models/teams/team.model');

const args = process.argv.slice(2);

const getJson = bent('json', {
  'User-Agent': 'linux:1212data:v1.0.0 (by /u/jokullmusic)',
});

if (args.length !== 2) {
  console.log(`Requires two arguments - season and week numbers. ${args.length} arguments were given.`);
  process.exit(1);
}

const [seasonNo, weekNo] = args.map((arg) => parseInt(arg, 10));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Get team names from game
 * @param {Object} game Game
 */
const getTeamNames = function getTeamNames(game) {
  const teamNameRegex = /Defense\n.*\n\[(.+)\].+\n\[(.+)\]/;
  const teamNameMatch = teamNameRegex.exec(game.selftext);
  return [teamNameMatch[1], teamNameMatch[2]];
};

/**
 * Fix conflicts
 * @param {Object} response The Reddit response to check for conflicts
 */
const ask = function ask(response) {
  return new Promise((resolve, reject) => {
    const { games, teamName } = response;

    if (games.length > 1) {
      let question = `Which game to use for ${teamName}?\n`;
      const ids = new Array(games.length);
      games.forEach((game, i) => {
        ids[i] = game.id;
        question += `${i}: ${game.title}\n`;
      });

      rl.question(question, (answer) => {
        if (answer === 'n') {
          resolve();
          return;
        }
        const answerInt = parseInt(answer, 10);
        if (Number.isNaN(answerInt)) {
          reject(new Error(`${answer} is not an integer.`));
          return;
        }
        if (!(answerInt in games)) {
          reject(new Error(`${answerInt} is not a valid choice.`));
          return;
        }
        console.log(`resolving q with ${answerInt}`);
        resolve({
          id: games[answerInt].id,
          teams: getTeamNames(games[answerInt]),
        });
      });
    } else if (games.length === 0) {
      console.log(`no game found for ${teamName}.`);
      resolve();
    } else {
      console.log(`resolving no-q with ${games.length} games`);
      if (!games[0].id) {
        console.log(games[0]);
      }
      resolve({
        id: games[0].id,
        teams: getTeamNames(games[0]),
      });
    }
  });
};

/**
 * Get new game IDs for the given team.
 * @param {String} teamName The team name to check for games for.
 */
const getID = async function getGameIDForTeam(teamName) {
  const query = `-flair:"Post Game Thread" title:"${teamName}"`;
  const results = await getJson(`https://api.reddit.com/r/FakeCollegeFootball/search.json?q=${query}&sort=new&restrict_sr=on&t=day`);
  const threads = results.data.children.map((result) => result.data);
  return {
    games: threads,
    teamName,
  };
};

/**
 * Ask the user.
 * @param {Array} responses The responses from Reddit.
 */
const filterIDs = async function filterIDsAndAskIfMultiple(response) {
  const answer = await ask(response);
  return answer;
};

const doTeamIDs = async function getTeamIDs(teams) {
  const ids = [];

  for (let i = 0; i < teams.length; i += 1) {
    const team = teams[i];
    if (!team.done) {
      // eslint-disable-next-line no-await-in-loop
      const response = await getID(team.name);
      // eslint-disable-next-line no-await-in-loop
      const answer = await filterIDs(response);
      if (answer) {
        for (let j = 0; j < teams.length; j += 1) {
          if (answer.teams.includes(teams[j].name)) {
            // eslint-disable-next-line no-param-reassign
            teams[j].done = true;
          }
        }
        ids.push(answer.id);
      }
    } else {
      console.log(`${team.name} already done, skipping`);
    }
  }

  rl.close();
  return ids;
};

const writeGames = function writeGamesToFile(games) {
  return new Promise((resolve, reject) => {
    fs.writeFile(
      `${__dirname}/weekGames.json`,
      JSON.stringify(games, null, 2),
      (writeErr) => {
        if (writeErr) {
          reject(writeErr);
        } else {
          console.log('Wrote to ./weekGames.json.');
          resolve();
        }
      },
    );
  });
};

mongoose.connect('mongodb://127.0.0.1:27017/1212', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
})
  .catch(console.error)
  .then(() => {
    Team.find({ 'division.2': { $not: { $eq: null } } })
      .then((teams) => {
        const teamNames = teams.map((team) => ({ name: team.name, done: false }));
        doTeamIDs(teamNames)
          .then((ids) => {
            writeGames({
              seasonNo,
              weekNo,
              games: ids,
            });
          });
      })
      .catch(console.error)
      .finally(() => mongoose.disconnect());
  });
