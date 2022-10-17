// utility functions for console logs

const logError = (error) => {
  if (error !== 'Connection closed' && error !== undefined) {
    logComment(`ERROR: ${error}`);
  }
};

const logComment = (comment) => {
  console.log(`${new Date()} ${comment}`);
};

module.exports = { logError, logComment };
