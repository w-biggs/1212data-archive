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
    for (let i = 0; i < comment.replies.length; i += 1) {
      const reply = comment.replies[i];
      const replyCheck = findResultComments(reply, comment);
      if (replyCheck !== false) {
        return replyCheck;
      }
    }
  }
  return false;
};

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

  console.error(`No play type found for play "${commentBody}"`);
  return false; // No play type found
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

    let numbersEqual = false;
    if (offNum === null || defNum === null) {
      numbersEqual = true;
    } else {
      numbersEqual = (offNum === gistPlay.offense.number && defNum === gistPlay.defense.number);
    }

    const locationEqual = (location === gistPlay.yardLine
      || (100 - location) === gistPlay.yardLine);

    if (playType === gistPlay.playType
      && numbersEqual
      && locationEqual
      && homeOffense === gistPlay.homeOffense) {
      return gistPlay;
    }
  }
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
    console.log(comment.body);
    console.log(comment.author);
    throw new Error('No result comment found');
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
 */
const parsePlayComment = function parsePlayComment(comment, homeTeam, awayTeam, gistPlays) {
  const { resultComment, parentComment } = findResultComments(comment, null);
  if (!resultComment) {
    console.log(comment.body);
    console.log(comment.author);
    throw new Error('No result comment found');
  }

  const numbersRegex = /Offense: ([0-9]+)\n+Defense: ([0-9]+)/gm;
  const numbersMatch = numbersRegex.exec(resultComment.body);
  let [offNum, defNum] = [null, null];
  if (numbersMatch) {
    [, offNum, defNum] = numbersMatch;
  }

  let quarter = 0;
  let clock = 0;
  const timeRegex = /([0-9]+):([0-9]+) left in the ([0-9]+)/gm;
  const timeMatch = timeRegex.exec(resultComment.body);
  if (timeMatch) {
    clock = (parseInt(timeMatch[1], 10) * 60) + parseInt(timeMatch[2], 10);
    quarter = parseInt(quarter[3], 10);
  } else {
    const quarterRegex = /[i|I]n the ([0-9]+)/;
    const quarterMatch = quarterRegex.exec(resultComment.body);
    quarter = parseInt(quarterMatch[1], 10);
  }

  const secondsRegex = /took ([0-9]+) seconds/gm;
  const secondsMatch = secondsRegex.exec(resultComment.body);
  let playLength = 0;
  if (!secondsMatch) {
    timeRegex.lastIndex = 0;
    const oldTimeMatch = timeRegex.exec(comment.body);
    if (oldTimeMatch) {
      const [, oldMins, oldSecs] = oldTimeMatch;
      const oldClock = (parseInt(oldMins, 10) * 60) + parseInt(oldSecs, 10);
      playLength = oldClock - clock;
    }
  } else {
    playLength = parseInt(secondsMatch[1], 10);
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

  const {
    offCoach,
    defCoach,
    homeOffense,
  } = parsePlayCoaches(comment, parentComment, homeTeam, awayTeam);

  const play = {
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
  play.result = gistMatch.result;
  play.yards = gistMatch.yards;
  play.down = gistMatch.down;
  play.distance = gistMatch.distance;
  play.yardLine = gistMatch.yardLine;

  if (offNum !== null && defNum !== null) {
    play.offense.number = parseInt(offNum, 10);
    play.defense.number = parseInt(defNum, 10);
  }

  return play;
};

module.exports = {
  parsePlayCoaches,
  parsePlayComment,
};
