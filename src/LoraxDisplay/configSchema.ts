import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseLinearDisplayConfigSchema from '@jbrowse/plugin-linear-genome-view/esm/BaseLinearDisplay/models/configSchema'

export default ConfigurationSchema(
  'LoraxDisplay',
  {
    height: {
      type: 'number',
      description: 'Default height of the Lorax display in pixels',
      defaultValue: 400,
    },
  },
  {
    baseConfiguration: baseLinearDisplayConfigSchema,
    explicitlyTyped: true,
  },
)
