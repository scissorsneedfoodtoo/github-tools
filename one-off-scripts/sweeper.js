/*
This script was originally created to iterate over all open PRs to label and
comment on specific PR errors (i.e. guide related filenmame syntax and
frontmatter).

Since the first run which covered over 10,000+ PRs, it is curently ran every
couple of days for just the most recent PRs.

To run the script for a specific range (i.e. label and comment on guide errors),
run `node sweeper.js range startingPrNumber endingPrNumber`
*/

const { owner, repo, octokitConfig, octokitAuth } = require('../lib/constants');

const octokit = require('@octokit/rest')(octokitConfig);

const { getPRs, getUserInput } = require('../lib/get-prs');
const { guideFolderChecks } = require('../lib/validation');
const { ProcessingLog, rateLimiter } = require('../lib/utils');
const { labeler } = require('../lib/pr-tasks');

octokit.authenticate(octokitAuth);

const log = new ProcessingLog('sweeper');

log.start();
console.log('Sweeper started...');
(async () => {
  const { totalPRs, firstPR, lastPR } = await getUserInput();
  const prPropsToGet = ['number', 'labels', 'user'];
  const { openPRs } = await getPRs(totalPRs, firstPR, lastPR, prPropsToGet);
  let count = 0;
  if (openPRs.length) {
    console.log('Processing PRs...');
    for (let i = 0; i < openPRs.length; i++) {
      let {
        number,
        labels: currentLabels,
        user: { login: username }
      } = openPRs[i];
      const { data: prFiles } = await octokit.pullRequests.listFiles({
        owner,
        repo,
        number
      });
      count++;

      const guideFolderErrorsComment = await guideFolderChecks(
        number,
        prFiles,
        username
      );
      const commentLogVal = guideFolderErrorsComment
        ? guideFolderErrorsComment
        : 'none';

      const labelsAdded = await labeler(
        number,
        prFiles,
        currentLabels,
        guideFolderErrorsComment
      );
      const labelLogVal = labelsAdded.length ? labelsAdded : 'none added';

      log.add(number, { number, comment: commentLogVal, labels: labelLogVal });
      if (count > 4000) {
        await rateLimiter(2350);
      }
    }
  }
})()
  .then(() => {
    log.finish();
    console.log('Sweeper complete');
  })
  .catch(err => {
    log.finish();
    console.log(err);
  });
