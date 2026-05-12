/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  // JBrowse 4 `@jbrowse/core` is ESM-only in package exports; map subpaths to
  // `esm/` so jest.resolve + jest.mock() match the on-disk modules.
  moduleNameMapper: {
    '^@jbrowse/core/data_adapters/BaseAdapter$':
      '<rootDir>/node_modules/@jbrowse/core/esm/data_adapters/BaseAdapter/index.js',
    '^@jbrowse/core/util/rxjs$':
      '<rootDir>/node_modules/@jbrowse/core/esm/util/rxjs.js',
    '^@jbrowse/core/util/io$':
      '<rootDir>/node_modules/@jbrowse/core/esm/util/io/index.js',
    '^@jbrowse/core/pluggableElementTypes/RpcMethodType$':
      '<rootDir>/node_modules/@jbrowse/core/esm/pluggableElementTypes/RpcMethodType.js',
    '^@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/SimpleField$':
      '<rootDir>/node_modules/@jbrowse/core/esm/BaseFeatureWidget/BaseFeatureDetail/SimpleField.js',
  },
}
