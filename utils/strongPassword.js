const defaultPasswordConfig = {
  base: 'WORD',
  length: {
    min: 8,
    max: 20,
  },
  capsLetters: {
    min: 3,
    max: 3,
  },
  numerals: {
    min: 2,
    max: 2,
  },
  spacialCharacters: {
    includes: [],
    min: 0,
    max: 0,
  },
  spaces: {
    allow: false,
    min: 0,
    max: 0,
  },
};

module.exports = { defaultPasswordConfig };
