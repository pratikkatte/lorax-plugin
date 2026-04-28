import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema('LoraxAdapter', {
  apiBase: {
    type: 'string',
    defaultValue: 'http://localhost:8080',
  },
  filePath: {
    type: 'string',
    defaultValue: '',
  },
  project: {
    type: 'string',
    defaultValue: '',
  },
  file: {
    type: 'string',
    defaultValue: '',
  },
  shareSid: {
    type: 'string',
    defaultValue: '',
  },
  useUpload: {
    type: 'boolean',
    defaultValue: false,
  },
  fileLocation: {
    type: 'fileLocation',
    defaultValue: {
      uri: '',
      locationType: 'UriLocation',
    },
  },
  isProd: {
    type: 'boolean',
    defaultValue: false,
  },
}, {
  explicitlyTyped: true,
  implicitIdentifier: 'adapterId',
})
