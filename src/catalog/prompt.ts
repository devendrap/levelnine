import { ComponentSchema } from './schemas'

export function generatePrompt(): string {
  const components = ComponentSchema.options.map((schema: any) => {
    const shape = schema.shape
    const typeName = shape.type._def.values?.[0] ?? shape.type._def.value ?? 'Unknown'
    const description = schema.description ?? ''
    const propsShape = shape.props.shape ?? {}

    const propDocs = Object.entries(propsShape).map(([key, val]: [string, any]) => {
      const desc = val.description ?? ''
      return `    - ${key}: ${desc}`
    }).join('\n')

    const hasChildren = 'children' in shape
    return `### ${typeName}\n${description}${hasChildren ? ' (container - accepts children)' : ''}\nProps:\n${propDocs}`
  })

  return [
    'You generate UI as JSON. Each node has { "type", "props", "children?" }.',
    'Available components:\n',
    ...components,
    '\nReturn a single root node. Use Stack/Row for layout. All props have sensible defaults.',
  ].join('\n')
}
