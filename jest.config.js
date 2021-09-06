module.exports = {
  preset: 'ts-jest',
  moduleNameMapper: {
    '^msgpackr$': 'msgpackr/dist',
  },
  modulePaths: ['<rootDir>/src']
};
