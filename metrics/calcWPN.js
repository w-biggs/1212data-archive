/**
 * Round numbers to avoid floating point errors.
 * @param {number} input The number to round.
 * @param {number} places The number of places to round to.
 * @returns {number} The rounded number.
 */
const round = function roundWithoutFloatingPointErrors(input, places) {
  return Number(Number(input).toFixed(places));
};

/**
 * Calculate the MoV modifier to add to the closeness score.
 * @param {number} mov The margin of victory.
 * @param {number} movInfluence The amount of influence the MoV has in the a score.
 * @param {number} movMultiplier The amount to multiply ln(MoV) by to fit it to the influence.
 * @returns {number} The calculated MoV modifier.
 */
const calcMoVModifier = function calculateMarginOfVictoryModifier(mov, movInfluence,
  movMultiplier) {
  return (0 - movInfluence) + (Math.log(mov + 1) * movMultiplier);
};

/**
 * Calculates either the win score or loss score. Win if a is positive, loss if negative.
 *
 * @param {string} teamName The name of the team.
 * @param {number} a The current `a` value.
 * @param {number} baseA The original `a` value.
 * @param {import('mongoose').Document} season The season to calculate the score for.
 * @param {number} maxWeek The week to calculate the score up to.
 * @param {number} movInfluence The amount of influence the MoV has in the a score.
 * @param {number} movMultiplier The amount to multiply ln(MoV) by to fit it to the influence.
 * @returns {number} The win or loss score.
 */
const calcScore = function calculateWinOrLossScore(teamName, a, baseA,
  season, maxWeek = false, movInfluence = 0, movMultiplier = false) {
  // Tiny A's are pointless to calculate.
  if (a < 0.0001 && a > -0.0001) {
    return 0;
  }

  // Base score
  let score = 0;

  // Calculate the new A value to use.
  const newA = round(a * baseA, 4);

  // Iterate across all season games
  for (let i = 0; i < season.weeks.length; i += 1) {
    const week = season.weeks[i];
    // Check whether week is being counted
    if (maxWeek === false || week.weekNo < maxWeek) {
      for (let j = 0; j < week.games.length; j += 1) {
        const game = week.games[j];
        // Check whether the game is final and involves this team
        if (!game.live
          && (game.homeTeam.team.name === teamName || game.awayTeam.team.name === teamName)
        ) {
          let gameScore = 0;

          const teamIsHome = game.homeTeam.team.name === teamName;
          const team = teamIsHome ? game.homeTeam : game.awayTeam;
          const opp = teamIsHome ? game.awayTeam : game.homeTeam;

          const teamScore = team.stats.score.final;
          const oppScore = opp.stats.score.final;

          if ((teamScore > oppScore && a > 0) || (teamScore < oppScore && a < 0)) {
            gameScore += a;
            if (movInfluence > 0) {
              const movModifier = calcMoVModifier(
                Math.abs(teamScore - oppScore),
                movInfluence,
                movMultiplier,
              );
              gameScore += (a * movModifier);
            }
            gameScore += calcScore(opp.name, newA, baseA, season, maxWeek,
              movInfluence, movMultiplier);
            
            score += gameScore;
          }
        }
      }
    }
  }

  return round(score, 4);
};

/**
 * Generate the PN score for a single team.
 * @param {string} team The team's name.
 * @param {import('mongoose').Document} season The season to calculate the score for.
 * @param {number} maxWeek The week to calculate the score up to.
 * @param {number} movInfluence The amount of influence the MoV has in the a score.
 * @param {number} medMov The median MoV.
 */
const generateTeamScore = async function generateTeamPNScore(team, season, maxWeek = false,
  movInfluence = 0, medMov) {
  /**
  * In their paper, Park and Newman have a complex process using eigenvalues or something
  * to find the optimal value for *a*. But that value hovers around 0.2 for every year they
  * tested, so I'm gonna just use 0.2.
  */
  const baseA = 0.2;
  
  // Calculate the MoV multiplier to fit the modifiers to the given amount of influence.
  const movMultiplier = movInfluence ? (movInfluence / Math.log(medMov + 1)) : false;
  
  const w = calcScore(team, 1, baseA, season, maxWeek, movInfluence, movMultiplier);
  const l = calcScore(team, -1, baseA, season, maxWeek, movInfluence, movMultiplier);
  const score = round(w + l, 4);

  return {
    team,
    score,
    w,
    l,
  };
};

module.exports = {
  generateTeamScore,
};
