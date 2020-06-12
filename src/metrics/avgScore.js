/**
 * Calculates the average score of games in the FCS for wPN.
 */
const Game = require('../models/schedules/game.model');

/**
 * Gets the median of an array of numbers.
 * @param {Array<Number>} movsArray The array of MoVs to get the median of.
 */
const calcMedian = function calcMedian(movsArray) {
  const half = Math.floor(movsArray.length / 2);
  
  movsArray.sort((a, b) => a - b);
  
  if (movsArray.length % 2) {
    return movsArray[half];
  }

  return (movsArray[half - 1] + movsArray[half]) / 2.0;
};

/**
 * Calculates the average score of all FCS games.
 */
const avgScore = async function calcAverageScore() {
  let totalScore = 0;
  let totalMoV = 0;
  const movs = [];
  const games = await Game.find().lean().exec();
  for (let i = 0; i < games.length; i += 1) {
    const game = games[i];
    totalScore += game.homeTeam.stats.score.final;
    totalScore += game.awayTeam.stats.score.final;
    
    const mov = Math.abs(game.homeTeam.stats.score.final - game.awayTeam.stats.score.final);
    totalMoV += mov;
    movs.push(mov);
  }

  return {
    score: (totalScore / (games.length * 2)),
    mov: totalMoV / games.length,
    medMov: calcMedian(movs),
  };
};

module.exports = avgScore;
