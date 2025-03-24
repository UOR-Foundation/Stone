// Mock for octokit
const Octokit = jest.fn().mockImplementation(() => ({
  rest: {
    issues: {
      get: jest.fn(),
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      listComments: jest.fn(),
      createComment: jest.fn(),
      listLabelsOnIssue: jest.fn(),
      addLabels: jest.fn(),
      removeLabel: jest.fn()
    },
    repos: {
      get: jest.fn(),
      getContent: jest.fn()
    }
  }
}));

module.exports = { Octokit };