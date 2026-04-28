import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

export default ConfigurationSchema('LoraxDisplay', {
  defaultHeight: {
    type: 'number',
    description: 'Default height of the Lorax display in pixels',
    defaultValue: 400,
  },
}, {
  baseConfiguration: baseLinearDisplayConfigSchema,
  explicitlyTyped: true,
})