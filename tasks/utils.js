/**
 * General utilities used in multiple tasks
 */
const bent = require('bent');

const getJson = bent('json', {
  'User-Agent': 'linux:1212data:v1.0.0 (by /u/jokullmusic)',
});

/**
 * Fetch a game from Reddit.
 * @param {String} gameId The game's thread ID
 */
const fetchGameJson = async function fetchGameJson(gameId) {
  const rawPost = await getJson(`https://api.reddit.com/comments/${gameId}/api/info.json?limit=500&depth=10`);
  const postInfo = rawPost[0].data.children[0].data;
  const comments = rawPost[1].data.children.map(comment => comment.data);
  if (rawPost[1].data.children[comments.length - 1].kind === 'more') {
    console.log('encountered a "more"!');
  }
  postInfo.comments = comments;
  return postInfo;
};

/**
 * fixes &amp; and nested &amp;s
 * @param {String} teamName The text to fix the entities in.
 */
const fixTeamHtmlEntities = function fixTeamHtmlEntities(teamName) {
  let fixedTeamName = teamName;
  while (fixedTeamName.indexOf('&amp;') >= 0) {
    fixedTeamName = fixedTeamName.replace('&amp;', '&');
  }
  return fixedTeamName;
};

module.exports = {
  fixTeamHtmlEntities,
  fetchGameJson,
};
