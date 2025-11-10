// utility functions for console logs

const logError = (error: string | undefined | null | unknown): void => {
  if (error !== 'Connection closed' && error !== undefined && error !== null) {
    logComment(`ERROR: ${error}`);
  }
};

const logComment = (comment: string): void => {
  console.log(`${new Date()} ${comment}`);
};

export { logError, logComment };
