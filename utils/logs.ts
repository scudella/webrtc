// utility functions for console logs

const logError = (error) => {
  if (error !== 'Connection closed' && error !== undefined && error !== null) {
    logComment(`ERROR: ${error}`);
  }
};

const logComment = (comment) => {
  console.log(`${new Date()} ${comment}`);
};

export { logError, logComment };
