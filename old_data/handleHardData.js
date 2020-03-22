/**
 * Handling teams (and in the future other "hard data")
 * A bit rough - learned how Mongoose works thru this
 */

const fcs = require('./fcs.json');
const Level = require('../models/teams/level.model');
const Conference = require('../models/teams/conference.model');
const Division = require('../models/teams/division.model');
const Team = require('../models/teams/team.model');

const levelsObj = [{
  name: 'Football Championship Subdivision',
  abbreviation: 'FCS',
}];

const saveLevel = function saveLevel(levelObj) {
  return new Promise((resolve, reject) => {
    const newLevel = new Level(levelObj);
    newLevel.save((err, level) => {
      if (err) {
        reject(err);
      } else {
        resolve(`Saved level ${levelObj.name}`);
      }
    });
  });
};

const checkLevels = function checkLevels() {
  return new Promise((resolve, reject) => {
    Level.find((err, levels) => {
      if (err) {
        return reject(err);
      }
      for (let i = 0; i < levelsObj.length; i += 1) {
        const levelObj = levelsObj[i];
        // Check if level is already in db
        if (levels.length > 0 && levels.filter(level => level.name === levelObj.name).length > 0) {
          return resolve(`Level "${levelObj.name}" already exists in database.`);
        }
        saveLevel(levelObj)
          .catch((saveErr) => {
            reject(saveErr);
          })
          .then((response) => {
            resolve(response);
          });
      }
    })
  });
};

const findLevel = function findLevel(query) {
  return new Promise((resolve, reject) => {
    Level.findOne(query, (err, level) => {
      if (err) {
        return reject(err);
      }
      return resolve(level);
    })
  });
};

const saveConf = function saveConf(confObj) {
  return new Promise((resolve, reject) => {
    findLevel({abbreviation: confObj.level})
      .catch((err) => {
        reject(err);
      })
      .then((level) => {
        if (level !== false) {
          // Found the level
          confObj.level = level._id;
          const newConf = new Conference(confObj);
          newConf.save((err, conf) => {
            if (err) {
              reject(err);
            } else {
              level.conferences.push(conf._id);
              level.save((levelErr) => {
                if (levelErr) {
                  reject(err);
                } else {
                  resolve(`Saved conference ${confObj.name}`);
                }
              });
            }
          });
        } else {
          reject(`Level ${confObj.level} does not exist.`);
        }
      });
  });
};

const checkConfs = function checkConfs(confObj) {
  return new Promise((resolve, reject) => {
    Conference.findOne({name: confObj.name}, (err, conference) => {
      if (err) {
        return reject(err);
      }
      if (conference) {
        // Check if conf is already in db
        return resolve(`Conference "${confObj.name}" already exists in database.`);
      }
      saveConf(confObj)
        .catch((saveErr) => {
          reject(saveErr);
        })
        .then((response) => {
          resolve(response);
        });
    });
  });
};

const saveDiv = function saveDiv(divObj) {
  return new Promise((resolve, reject) => {
    Conference.findOne({name: divObj.conference}, (err, conf) => {
      if (err) {
        reject(err);
      } else {
        if (conf) {
          divObj.conference = conf._id;
          const newDiv = new Division(divObj);
          newDiv.save((err, div) => {
            if (err) {
              reject(err);
            } else {
              conf.divisions.push(div._id);
              conf.save((confErr) => {
                if (confErr) {
                  reject(confErr);
                } else {
                  resolve(`Saved division ${divObj.name}`);
                }
              });
            }
          });
        } else {
          reject(`Conference "${divObj.conference}" not found in database.`);
        }
      }
    });
  });
};

const checkDivs = function checkDivs(divObj) {
  return new Promise((resolve, reject) => {
    Division.find({name: divObj.name}).populate('conference').exec((err, divisions) => {
      if (err) {
        return reject(err);
      }
      if (divisions && divisions.length > 0) {
        console.log(divisions);
        // Check if within the correct conf
        for (let i = 0; i < divisions.length; i += 1) {
          const division = divisions[i];
          if (division.conference.name === divObj.conference) {
            return resolve(`Division "${divObj.name}" already exists in database.`);
          }
        }
        saveDiv(divObj)
          .catch((saveErr) => {
            reject(saveErr);
          })
          .then((response) => {
            resolve(response);
          });
      } else {
        saveDiv(divObj)
          .catch((saveErr) => {
            reject(saveErr);
          })
          .then((response) => {
            resolve(response);
          });
      }
    });
  });
};

const saveTeam = function saveTeam(teamObj) {
  return new Promise((resolve, reject) => {
    Division.find({name: teamObj.division.name}).populate('conference').exec((err, divs) => {
      if (err) {
        reject(err);
      } else {
        if (divs && divs.length > 0) {
          for (let i = 0; i < divs.length; i += 1) {
            const div = divs[i];
            if (div.conference.name === teamObj.division.conf) {
              teamObj.division = div._id;
              const newTeam = new Team(teamObj);
              newTeam.save((err, team) => {
                if (err) {
                  reject(err);
                } else {
                  div.depopulate();
                  div.teams.push(div._id);
                  div.save((divErr) => {
                    if (divErr) {
                      reject(divErr);
                    } else {
                      resolve(`Saved team ${teamObj.name}`);
                    }
                  });
                }
              });
            }
          }
        } else {
          reject(`Division "${teamObj.division.name}" not found in database.`);
        }
      }
    });
  });
};

const checkTeams = function checkTeams(teamObj) {
  return new Promise((resolve, reject) => {
    Team.findOne({name: teamObj.name}, (err, team) => {
      if (err) {
        return reject(err);
      }
      if (team) {
        // Check if within the correct conf
        resolve(`Team "${teamObj.name}" already exists in database.`);
      } else {
        saveTeam(teamObj)
          .catch((saveErr) => {
            reject(saveErr);
          })
          .then((response) => {
            resolve(response);
          });
      }
    });
  });
};

const handleSingleTeam = function handleSingleTeam(team, level) {
  return new Promise((resolve, reject) => {
    console.log(`Doing ${team.name}`);
  
    const confObj = {
      name: team.conf,
      shortName: team.fullConf,
      level,
    };
  
    const divObj = {
      name: team.div,
      conference: team.conf,
    }
  
    const teamObj = {
      name: team.name,
      abbreviation: team.abbr,
      color: team.color,
      division: {
        name: team.div,
        conf: team.conf,
      },
    }
  
    if ('short' in team) {
      team.shortName = team.short;
    }
  
    checkConfs(confObj)
      .catch((err) => {
        reject(err);
      })
      .then((confResponse) => {
        console.log(confResponse);
  
        checkDivs(divObj)
          .catch((err) => {
            reject(err);
          })
          .then((divResponse) => {
            console.log(divResponse);
  
            checkTeams(teamObj)
              .catch((err) => {
                reject(err);
              })
              .then((teamResponse) => {
                resolve(teamResponse);
              });
          });
      });
  });
};

const handleAllTeams = async function handleAllTeams(teams, level) {
  for (let i = 0; i < teams.length; i += 1) {
    const team = teams[i];
    await handleSingleTeam(team, 'FCS');
  }

  return 'Saved all teams!'
}

const handleTeamData = function handleTeamData() {
  return new Promise((resolve, reject) => {
    checkLevels()
      .catch((err) => {
        reject(err);
      })
      .then((response) => {
        console.log(response);

        handleAllTeams(fcs.teams, 'FCS')
          .catch((err) => {
            reject(err);
          })
          .then((allResponse) => {
            resolve(allResponse);
          });
      });
  });
};

module.exports = {
  handleTeams: handleTeamData
};