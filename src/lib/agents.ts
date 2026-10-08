import type { AgentTool } from '../api/types'

/** Nombre con el que aparece cada agente en Cellula (Conectar mi agente y Actividad). */
export const AGENT_NAME: Record<AgentTool, string> = {
  claude: 'Claude Code',
  cursor: 'Cursor',
  'claude-web': 'Claude',
}

/** Dirección del servidor MCP de Cellula (la que se pega en el agente). */
export const MCP_HOST = 'mcp.cellula.app'
export const MCP_URL = `https://${MCP_HOST}/mcp`
