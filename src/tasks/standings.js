const Conference = require('../models/teams/conference.model');
const Season = require('../models/schedules/season.model');
const Team = require('../models/teams/team.model');

/**
 * Adds a game to the standings stats.
 * @param {Object[]} conferences The conference array.
 * @param {Object} team The team.
 * @param {Object} opp The opponent.
 * @param {Number} pf The points scored by this team.
 * @param {Number} pa The poitns allowed by this team.
 * @param {Number} seasonNo The season number to compile standings for.
 * @param {Number} weekNo The week number this game is for.
 * @returns {Object[]} The updated conference array.
 */
const updateTeam = function updateTeam(conferences, team, opp, pf, pa, seasonNo, weekNo) {
  for (let i = 0; i < conferences.length; i += 1) {
    const conference = conferences[i];
    for (let j = 0; j < conference.divisions.length; j += 1) {
      const division = conference.divisions[j];
      if (division._id.equals(team.division[seasonNo - 1])) {
        // Make sure the teams array is there
        if (!division.teams) {
          division.teams = [];
        }
        let teamIndex = division.teams.findIndex((divTeam) => divTeam.name === team.name);
        if (teamIndex < 0) {
          division.teams.push({
            name: team.name,
            abbreviation: team.abbreviation,
            overall: {
              wins: 0,
              losses: 0,
              ties: 0,
              pf: 0,
              pa: 0,
              streak: {
                type: false,
                duration: 0,
              },
            },
            conference: {
              wins: 0,
              losses: 0,
              ties: 0,
              pf: 0,
              pa: 0,
            },
            division: {
              wins: 0,
              losses: 0,
              ties: 0,
              pf: 0,
              pa: 0,
            },
          });
          teamIndex = division.teams.length - 1;
        }
        const divTeam = division.teams[teamIndex];
        const divGame = team.division[seasonNo - 1].equals(opp.division[seasonNo - 1]);
        
        // Conf games are any non-OOC week games - rescheduled conf week games are still conf games
        const confGame = (seasonNo === 1 && weekNo < 5)
          || (seasonNo !== 1 && ![1, 2, 5, 8].includes(weekNo));
        
        if (pf > pa) {
          divTeam.overall.wins += 1;
          divTeam.conference.wins += confGame ? 1 : 0;
          divTeam.division.wins += divGame ? 1 : 0;
          if (divTeam.overall.streak.type === 'W') {
            divTeam.overall.streak.duration += 1;
          } else {
            divTeam.overall.streak.type = 'W';
            divTeam.overall.streak.duration = 1;
          }
        } else if (pa > pf) {
          divTeam.overall.losses += 1;
          divTeam.conference.losses += confGame ? 1 : 0;
          divTeam.division.losses += divGame ? 1 : 0;
          if (divTeam.overall.streak.type === 'L') {
            divTeam.overall.streak.duration += 1;
          } else {
            divTeam.overall.streak.type = 'L';
            divTeam.overall.streak.duration = 1;
          }
        } else {
          divTeam.overall.ties += 1;
          divTeam.conference.ties += confGame ? 1 : 0;
          divTeam.division.ties += divGame ? 1 : 0;
          if (divTeam.overall.streak.type === 'T') {
            divTeam.overall.streak.duration += 1;
          } else {
            divTeam.overall.streak.type = 'T';
            divTeam.overall.streak.duration = 1;
          }
        }

        divTeam.overall.pf += pf;
        divTeam.conference.pf += confGame ? pf : 0;
        divTeam.division.pf += divGame ? pf : 0;

        divTeam.overall.pa += pa;
        divTeam.conference.pa += confGame ? pa : 0;
        divTeam.division.pa += divGame ? pa : 0;
      }
    }
  }

  return conferences;
};

/**
 * Finds the head to head results.
 * @param {Object} team The team.
 * @param {Object} opp The opponent.
 * @param {Object} season The season.
 */
const getHeadToHead = function getHeadToHead(team, opp, season) {
  for (let i = 0; i < season.weeks.length; i += 1) {
    const week = season.weeks[i];
    const matchups = week.games.filter((game) => (
      game.homeTeam.team.name === team.name && game.awayTeam.team.name === opp.name
    ) || (
      game.awayTeam.team.name === team.name && game.homeTeam.team.name === opp.name
    ));
    if (matchups.length) {
      const winners = [];
      for (let j = 0; j < matchups.length; j += 1) {
        const matchup = matchups[j];
        if (matchup.homeTeam.stats.score.final > matchup.awayTeam.stats.score.final) {
          winners.push(matchup.homeTeam.team.name);
        } else if (matchup.awayTeam.stats.score.final > matchup.homeTeam.stats.score.final) {
          winners.push(matchup.awayTeam.team.name);
        } else {
          return 0;
        }
      }
      if (winners.every((winner) => winner === team.name)) {
        return -1;
      }
      if (winners.every((winner) => winner === opp.name)) {
        return 1;
      }
      return 0;
    }
  }
  return 0;
};

/**
 * Finds the better team in common games.
 * @param {Object} team The team.
 * @param {Object} opp The opponent.
 * @param {Object} season The season.
 */
const getCommonGames = function getCommonGames(team, opp, season) {
  const teamGames = {};
  const oppGames = {};
  for (let i = 0; i < season.weeks.length; i += 1) {
    const week = season.weeks[i];
    for (let j = 0; j < week.games.length; j += 1) {
      const game = week.games[j];
      if (game.homeTeam.team.name === team.name) {
        const margin = game.homeTeam.stats.score.final - game.awayTeam.stats.score.final;
        if (teamGames[game.awayTeam.team.name]) {
          teamGames[game.awayTeam.team.name].push(margin);
        } else {
          teamGames[game.awayTeam.team.name] = [margin];
        }
      } else if (game.awayTeam.team.name === team.name) {
        const margin = game.awayTeam.stats.score.final - game.homeTeam.stats.score.final;
        if (teamGames[game.homeTeam.team.name]) {
          teamGames[game.homeTeam.team.name].push(margin);
        } else {
          teamGames[game.homeTeam.team.name] = [margin];
        }
      }
      if (game.homeTeam.team.name === opp.name) {
        const margin = game.homeTeam.stats.score.final - game.awayTeam.stats.score.final;
        if (oppGames[game.awayTeam.team.name]) {
          oppGames[game.awayTeam.team.name].push(margin);
        } else {
          oppGames[game.awayTeam.team.name] = [margin];
        }
      } else if (game.awayTeam.team.name === opp.name) {
        const margin = game.awayTeam.stats.score.final - game.homeTeam.stats.score.final;
        if (oppGames[game.homeTeam.team.name]) {
          oppGames[game.homeTeam.team.name].push(margin);
        } else {
          oppGames[game.homeTeam.team.name] = [margin];
        }
      }
    }
  }

  const teamRecord = [0, 0, 0];
  const oppRecord = [0, 0, 0];
  for (let i = 0; i < Object.keys(teamGames).length; i += 1) {
    const gameOpp = Object.keys(teamGames)[i];
    const commonGames = oppGames[gameOpp];
    if (commonGames) {
      const margins = teamGames[gameOpp];
      for (let j = 0; j < margins.length; j += 1) {
        const margin = margins[j];
        if (margin > 0) {
          teamRecord[0] += 1;
        } else if (margin < 0) {
          teamRecord[1] += 1;
        } else {
          teamRecord[2] += 1;
        }
      }
      for (let j = 0; j < commonGames.length; j += 1) {
        const margin = commonGames[j];
        if (margin > 0) {
          oppRecord[0] += 1;
        } else if (margin < 0) {
          oppRecord[1] += 1;
        } else {
          oppRecord[2] += 1;
        }
      }
    }
  }

  const totalTeamGames = teamRecord.reduce((acc, curr) => acc + curr);
  if (teamRecord.reduce((acc, curr) => acc + curr) === 0) {
    return 0;
  }

  const totalOppGames = oppRecord.reduce((acc, curr) => acc + curr);

  const teamPercentage = (teamRecord[0] + (teamRecord[2] / 2)) / totalTeamGames;
  const oppPercentage = (oppRecord[0] + (oppRecord[2] / 2)) / totalOppGames;

  return oppPercentage - teamPercentage;
};

const sortDivision = function sortDivision(season) {
  return (a, b) => {
    // Conference wins
    if (a.conference.wins !== b.conference.wins) {
      return b.conference.wins - a.conference.wins;
    }
    // Conference games over .500
    if ((a.conference.wins - a.conference.losses) !== (b.conference.wins - b.conference.losses)) {
      return (b.conference.wins - b.conference.losses) - (a.conference.wins - a.conference.losses);
    }
    // Head to head
    const headToHead = getHeadToHead(a, b, season);
    if (headToHead !== 0) {
      return headToHead;
    }
    // Division wins
    if (a.division.wins !== b.division.wins) {
      return b.division.wins - a.division.wins;
    }
    // Division games over .500
    if ((a.division.wins - a.division.losses) !== (b.division.wins - b.division.losses)) {
      return (b.division.wins - b.division.losses) - (a.division.wins - a.division.losses);
    }
    // Common games
    const commonRecord = getCommonGames(a, b, season);
    if (commonRecord !== 0) {
      return commonRecord;
    }
    // Conference point diff
    if ((a.conference.pf - a.conference.pa) !== (b.conference.pf - b.conference.pa)) {
      return (b.conference.pf - b.conference.pa) - (a.conference.pf - a.conference.pa);
    }
    // Division point diff
    if ((a.division.pf - a.division.pa) !== (b.division.pf - b.division.pa)) {
      return (b.division.pf - b.division.pa) - (a.division.pf - a.division.pa);
    }
    return 0;
  };
};

/**
 * Fills the divisions with teams.
 * @param {Object[]} conferences The conference array.
 * @param {Number} seasonNo The season number to compile standings for.
 * @returns {Object[]} The filled conferences.
 */
const fillDivisions = async function fillDivisions(conferences, seasonNo) {
  const teams = await Team.find().lean();
  for (let i = 0; i < conferences.length; i += 1) {
    const conference = conferences[i];
    for (let j = 0; j < conference.divisions.length; j += 1) {
      const division = conference.divisions[j];
      division.teams = [];
      for (let k = 0; k < teams.length; k += 1) {
        const team = teams[k];
        if (division._id.equals(team.division[seasonNo - 1])) {
          division.teams.push({
            name: team.name,
            abbreviation: team.abbreviation,
            overall: {
              wins: 0,
              losses: 0,
              ties: 0,
              pf: 0,
              pa: 0,
              streak: {
                type: 'N/A',
                duration: '',
              },
            },
            conference: {
              wins: 0,
              losses: 0,
              ties: 0,
              pf: 0,
              pa: 0,
            },
            division: {
              wins: 0,
              losses: 0,
              ties: 0,
              pf: 0,
              pa: 0,
            },
          });
        }
      }
    }
  }
  console.log('done');
  return conferences;
};

/**
 * Compiles the standings for a given season.
 * @param {Number} seasonNo The season number to compile standings for.
 * @returns {Object[]} The standings.
 */
const compileStandings = async function compileStandings(seasonNo) {
  let conferences = await Conference.find()
    .lean()
    .populate('divisions');
  conferences = await fillDivisions(conferences, seasonNo);
  const season = await Season.findOne({ seasonNo })
    .lean()
    .populate({
      path: 'weeks',
      populate: {
        path: 'games',
        populate: [{
          path: 'homeTeam.team',
        }, {
          path: 'awayTeam.team',
        }],
      },
    });
  for (let i = 0; i < season.weeks.length; i += 1) {
    const week = season.weeks[i];
    if (week.weekNo < 13) {
      for (let j = 0; j < week.games.length; j += 1) {
        const game = week.games[j];
        if (!game.live) {
          conferences = updateTeam(
            conferences,
            game.homeTeam.team,
            game.awayTeam.team,
            game.homeTeam.stats.score.final,
            game.awayTeam.stats.score.final,
            seasonNo,
            week.weekNo,
          );
          conferences = updateTeam(
            conferences,
            game.awayTeam.team,
            game.homeTeam.team,
            game.awayTeam.stats.score.final,
            game.homeTeam.stats.score.final,
            seasonNo,
            week.weekNo,
          );
        }
      }
    }
  }
  // sort
  for (let i = 0; i < conferences.length; i += 1) {
    const conference = conferences[i];
    for (let j = 0; j < conference.divisions.length; j += 1) {
      // TEMP FIX
      if (conference.divisions[j].teams) {
        conference.divisions[j].teams.sort(sortDivision(season));
      }
    }
    // Fix ordering of north/south, east/west, etc
    conference.divisions.sort((a, b) => {
      const aComp = a.name;
      const bComp = b.name;
      if (aComp === 'EAST' || aComp === 'NORTH') {
        return -1;
      }
      if (aComp === 'WEST' || aComp === 'SOUTH') {
        return 1;
      }
      return aComp.localeCompare(bComp);
    });
  }
  // Alphabetize
  return conferences.sort((a, b) => a.name.localeCompare(b.name));
};

module.exports = compileStandings;
