/**
 * General utilities used in multiple tasks
 */

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
};
