class TeamStats {
  constructor(name) {
    this.name = name;
    this.wins = 0;
    this.losses = 0;
    this.ties = 0;
    this.timeOfPossession = 0;
    this.gameTime = 0;
    this.offenseStats = {
      passYds: 0,
      rushYds: 0,
      interceptions: 0,
      fumbles: 0,
      fieldGoals: {
        attempts: 0,
        makes: 0,
      },
      points: 0,
      // Dynamic stats
      yards: 0,
      turnovers: 0,
      adjPointsPG: 0,
      timeOfPossessionP28: 0,
      adjPassYdsPG: 0,
      adjRushYdsPG: 0,
      adjYardsPG: 0,
    };
    this.defenseStats = {
      passYds: 0,
      rushYds: 0,
      interceptions: 0,
      fumbles: 0,
      fieldGoals: {
        attempts: 0,
        makes: 0,
      },
      points: 0,
      // Dynamic stats
      yards: 0,
      turnovers: 0,
      adjPointsPG: 0,
      timeOfPossessionP28: 0,
      adjPassYdsPG: 0,
      adjRushYdsPG: 0,
      adjYardsPG: 0,
    };
    // Dynamic stats
    this.pointDiff = 0;
    this.adjPointDiffPG = 0;
    this.yardDiff = 0;
    this.adjYardDiffPG = 0;
    this.turnoverDiff = 0;
    this.expectedWins = 0;
    this.expectedLosses = 0;
    this.expectedDiff = 0;
    this.timePG = 0;
  }

  addGame(teamStats, oppStats) {
    const margin = teamStats.score.final - oppStats.score.final;
    if (margin > 0) {
      this.wins += 1;
    } else if (margin < 0) {
      this.losses += 1;
    } else {
      this.ties += 1;
    }
    this.timeOfPossession += teamStats.timeOfPossession;
    this.gameTime += teamStats.timeOfPossession + oppStats.timeOfPossession;
    this.offenseStats.passYds += teamStats.passYds;
    this.offenseStats.rushYds += teamStats.rushYds;
    this.offenseStats.interceptions += teamStats.interceptions;
    this.offenseStats.fumbles += teamStats.fumbles;
    this.offenseStats.fieldGoals.attempts += teamStats.fieldGoals.attempts;
    this.offenseStats.fieldGoals.makes += teamStats.fieldGoals.makes;
    this.offenseStats.points += teamStats.score.final;
    this.defenseStats.passYds += oppStats.passYds;
    this.defenseStats.rushYds += oppStats.rushYds;
    this.defenseStats.interceptions += oppStats.interceptions;
    this.defenseStats.fumbles += oppStats.fumbles;
    this.defenseStats.fieldGoals.attempts += oppStats.fieldGoals.attempts;
    this.defenseStats.fieldGoals.makes += oppStats.fieldGoals.makes;
    this.defenseStats.points += oppStats.score.final;
  }

  toJSON() {
    const gameCount = this.wins + this.losses + this.ties;
    const adj = (1680 * gameCount) / this.gameTime;

    this.pointDiff = this.offenseStats.points - this.defenseStats.points;
    this.adjPointDiffPG = (this.pointDiff * adj) / gameCount;

    this.offenseStats.yards = this.offenseStats.rushYds + this.offenseStats.passYds;
    this.defenseStats.yards = this.defenseStats.rushYds + this.defenseStats.passYds;
    this.yardDiff = this.offenseStats.yards - this.defenseStats.yards;
    this.adjYardDiffPG = (this.yardDiff * adj) / gameCount;

    this.offenseStats.turnovers = this.offenseStats.interceptions + this.offenseStats.fumbles;
    this.defenseStats.turnovers = this.defenseStats.interceptions + this.defenseStats.fumbles;
    this.turnoverDiff = this.offenseStats.turnovers - this.defenseStats.turnovers;

    const expectedWinPercentage = (this.offenseStats.points ** 2.37)
      / ((this.offenseStats.points ** 2.37) + (this.defenseStats.points ** 2.37));
    this.expectedWins = expectedWinPercentage * gameCount;
    this.expectedLosses = (1 - expectedWinPercentage) * gameCount;
    this.expectedDiff = (this.wins + (this.ties / 2)) - this.expectedWins;

    this.timePG = this.gameTime / gameCount;

    this.offenseStats.adjPointsPG = (this.offenseStats.points * adj) / gameCount;
    this.offenseStats.timeOfPossessionP28 = (this.timeOfPossession / this.gameTime)
      * 28;
    this.offenseStats.adjPassYdsPG = (this.offenseStats.passYds * adj) / gameCount;
    this.offenseStats.adjRushYdsPG = (this.offenseStats.rushYds * adj) / gameCount;
    this.offenseStats.adjYardsPG = (this.offenseStats.yards * adj) / gameCount;

    this.defenseStats.adjPointsPG = (this.defenseStats.points * adj) / gameCount;
    this.defenseStats.timeOfPossessionP28 = 28 - this.offenseStats.timeOfPossessionP28;
    this.defenseStats.adjPassYdsPG = (this.defenseStats.passYds * adj) / gameCount;
    this.defenseStats.adjRushYdsPG = (this.defenseStats.rushYds * adj) / gameCount;
    this.defenseStats.adjYardsPG = (this.defenseStats.yards * adj) / gameCount;

    return this;
  }
}

module.exports = TeamStats;
