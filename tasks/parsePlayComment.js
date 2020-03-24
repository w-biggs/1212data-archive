

/**
 * Find the play type from the comment body.
 * @param {String} commentBody The body of the comment to search
 */
const findPlayType = function findPlayTypeFromCommentBody(commentBody) {
  const playTypes = [
    ['run', 'RUN'],
    ['pass', 'PASS'],
    ['punt', 'PUNT'],
    ['field goal', 'FIELD_GOAL'],
    ['kneel', 'KNEEL'],
    ['spike', 'SPIKE'],
    ['two point', 'TWO_POINT'],
    ['pat', 'PAT'],
    ['normal', 'KICKOFF_NORMAL'],
    ['squib', 'KICKOFF_SQUIB'],
    ['onside', 'KICKOFF_ONSIDE'],
  ];

  for (let i = 0; i < playTypes.length; i += 1) {
    const playType = playTypes[i];
    if (commentBody.toLowerCase().includes(playType[0])) {
      return playType[1];
    }
  }

  // console.error(`No play type found for play "${commentBody}"`);
  return false; // No play type found
};

/**
 * Finds the result comment. Returns false if there is none.
 * @param {Object} comment The comment to find the result comment from.
 * @param {Object} parentComment The parent comment.
 */
const findResultComments = function findResultComments(comment, parentComment) {
  // Check if is a result comment
  // End of regulation just says "In the 5th."
  if (comment.body.indexOf('has submitted') === -1
    && (comment.body.indexOf('left in the') >= 0 || comment.body.indexOf('In the') > 0)) {
    return {
      resultComment: comment,
      parentComment,
    };
  }
  if (comment.replies && comment.replies.length) {
    // First look for ones with result comments
    for (let i = 0; i < comment.replies.length; i += 1) {
      const reply = comment.replies[i];
      const replyCheck = findResultComments(reply, comment);
      if (replyCheck !== false) {
        return replyCheck;
      }
    }
    // If no result comments exist, look for the first valid play
    for (let i = 0; i < comment.replies.length; i += 1) {
      const reply = comment.replies[i];
      if (findPlayType(reply.body) !== false) {
        return {
          parentComment: reply,
        };
      }
    }
  }
  return false;
};

/**
 * Finds the matching gist.
 * @param {String} playType The play type
 * @param {Number} offNum The offensive number
 * @param {Number} defNum The defensive number
 * @param {Number} location The play location
 * @param {Boolean} homeOffense Whether the home team is on offense or not
 * @param {Object[]} gistPlays The list of plays from the gist
 */
const findMatchingGist = function findMatchingGist(
  playType, offNum, defNum, location, homeOffense, gistPlays,
) {
  for (let i = 0; i < gistPlays.length; i += 1) {
    const gistPlay = gistPlays[i];

    let playTypeEqual = false;
    if (playType) {
      playTypeEqual = playType === gistPlay.playType;
    } else {
      playTypeEqual = true;
    }

    let numbersEqual = false;
    if (offNum === null || defNum === null) {
      numbersEqual = true;
    } else {
      numbersEqual = (offNum === gistPlay.offense.number && defNum === gistPlay.defense.number);
    }

    let locationEqual = false;
    if (
      (location === gistPlay.yardLine
      || (100 - location) === gistPlay.yardLine)
    ) {
      locationEqual = true;
    } else if (
      (i - 1 >= 0)
      && gistPlays[i - 1].result === 'SAFETY'
      && (location === 35 || location === 65)
      && (gistPlay.yardLine === 20 || gistPlay.yardLine === 80)
    ) {
      // Match a kickoff after a safety
      locationEqual = true;
    }

    if (playTypeEqual
      && numbersEqual
      && locationEqual
      && homeOffense === gistPlay.homeOffense) {
      return gistPlay;
    }
  }
  // eslint-disable-next-line prefer-rest-params
  console.log(playType, offNum, defNum, location, homeOffense);
  return false;
};

/**
 * Get the coach names from the comment
 * @param {Object} comment The comment to parse
 * @param {Object} parentComment The parent comment
 * @param {Object} homeTeam The home team info
 * @param {Object} awayTeam The away team info
 */
const parsePlayCoaches = function parsePlayCoaches(comment, parentComment, homeTeam, awayTeam) {
  let parent = parentComment;
  if (!parentComment) {
    ({ parentComment: parent } = findResultComments(comment, null));
  }
  if (!parent) {
    // No result comment found
    return null;
  }

  const offenseTeamRegex = /\. (.+) you're up/gm;
  const offenseTeamMatch = offenseTeamRegex.exec(comment.body);
  const homeOffense = (offenseTeamMatch[1] === homeTeam.team);

  const defCoach = [];
  if (homeOffense) {
    for (let i = 0; i < awayTeam.coaches.length; i += 1) {
      defCoach.push(awayTeam.coaches[i].name);
    }
  } else {
    for (let i = 0; i < homeTeam.coaches.length; i += 1) {
      defCoach.push(homeTeam.coaches[i].name);
    }
  }

  const offCoach = `/u/${parent.author.name.toLowerCase()}`;

  return {
    offCoach,
    defCoach,
    homeOffense,
  };
};

/**
 * Get the play info from the comment
 * @param {Object} comment The comment to parse
 * @param {Object} homeTeam The home team info
 * @param {Object} awayTeam The away team info
 * @param {Object[]} gistPlays The list of plays from the gist
 * @param {Object} comment The next comment, for plays with missing result comments
 */
const parsePlayComment = function parsePlayComment(
  comment, homeTeam, awayTeam, gistPlays, nextComment,
) {
  const { resultComment, parentComment } = findResultComments(comment, null);

  let quarter = 0;
  let clock = 0;
  const timeRegex = /([0-9]+):([0-9]+) left in the ([0-9]+)/gm;
  const timeMatch = timeRegex.exec(comment.body);
  if (timeMatch) {
    clock = (parseInt(timeMatch[1], 10) * 60) + parseInt(timeMatch[2], 10);
    quarter = parseInt(timeMatch[3], 10);
  } else {
    const quarterRegex = /[i|I]n the ([0-9]+)/;
    const quarterMatch = quarterRegex.exec(comment.body);
    console.log(comment.body);
    quarter = parseInt(quarterMatch[1], 10);
  }

  let [offNum, defNum] = [null, null];
  let playLength = 0;

  if (resultComment) {
    // Play numbers
    const numbersRegex = /Offense: ([0-9]+)\n+Defense: ([0-9]+)/gm;
    const numbersMatch = numbersRegex.exec(resultComment.body);
    if (numbersMatch) {
      [, offNum, defNum] = numbersMatch.map(num => parseInt(num, 10));
    }

    // Play length
    const secondsRegex = /took ([0-9]+) seconds/gm;
    const secondsMatch = secondsRegex.exec(resultComment.body);
    if (!secondsMatch) {
      timeRegex.lastIndex = 0;
      const newTimeMatch = timeRegex.exec(resultComment.body);
      if (newTimeMatch) {
        const [, newMins, newSecs] = newTimeMatch;
        const newClock = (parseInt(newMins, 10) * 60) + parseInt(newSecs, 10);
        if ((clock - newClock) < 0) {
          if (newClock === 420) {
            playLength = clock;
          } else {
            throw new Error(`Weird time issue: old clock is ${clock}, new clock is ${newClock}.`);
          }
        } else {
          playLength = clock - newClock;
        }
      }
    } else {
      playLength = parseInt(secondsMatch[1], 10);
    }
  } else {
    if (!nextComment) {
      return false; // Ignore this play.
    }
    console.log(`No result comment found for play ${comment.id}.`);
    timeRegex.lastIndex = 0;
    const nextTimeMatch = timeRegex.exec(nextComment.body);
    if (nextTimeMatch) {
      const [, nextMins, nextSecs] = nextTimeMatch;
      const nextClock = (parseInt(nextMins, 10) * 60) + parseInt(nextSecs, 10);
      if ((clock - nextClock) < 0) {
        if (nextClock === 420) {
          playLength = clock;
        } else {
          throw new Error(`Weird time issue: old clock is ${clock}, next clock is ${nextClock}.`);
        }
      } else {
        playLength = clock - nextClock;
      }
    }
  }

  const playType = findPlayType(parentComment.body);

  let location = 0;
  if (comment.body.indexOf('KICKOFF') > 0) {
    location = 35;
  } else if (comment.body.indexOf('CONVERSION') > 0) {
    location = 3;
  } else {
    const locationRegex = /on the.+?([0-9]+)\./gm;
    const locationMatch = locationRegex.exec(comment.body);
    if (!locationMatch) {
      console.log(comment.body);
    }
    location = parseInt(locationMatch[1], 10);
  }

  const playCoaches = parsePlayCoaches(comment, parentComment, homeTeam, awayTeam);

  if (!playCoaches) {
    return null;
  }

  const { offCoach, defCoach, homeOffense } = playCoaches;

  const commentId = comment.id;

  const play = {
    commentId,
    homeOffense,
    offense: {
      coach: offCoach,
    },
    defense: {
      coach: defCoach,
    },
    playType,
    quarter,
    clock,
    playLength,
  };

  const gistMatch = findMatchingGist(playType, offNum, defNum, location, homeOffense, gistPlays);
  if (!gistMatch) {
    throw new Error(`No gist match found for play ${comment.id}`);
  }
  play.result = gistMatch.result;
  play.yards = gistMatch.yards;
  play.down = gistMatch.down;
  play.distance = gistMatch.distance;
  play.yardLine = gistMatch.yardLine;
  play.playType = gistMatch.playType;

  if (offNum !== null && defNum !== null) {
    play.offense.number = offNum;
    play.defense.number = defNum;
  } else if (!Number.isNaN(gistMatch.offense.number) && !Number.isNaN(gistMatch.defense.number)) {
    play.offense.number = gistMatch.offense.number;
    play.defense.number = gistMatch.defense.number;
  }

  return play;
};

module.exports = {
  parsePlayCoaches,
  parsePlayComment,
};
