/**
 * Selection domain MCP tools (5 tools).
 *
 * Maps to window.CyWebApi.selection.* methods.
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { Page } from 'playwright'
import { callApi } from '../callApi.js'
import type { BridgeResult } from '../types.js'

// ── Tool definitions ────────────────────────────────────────────────────────

export const selectionToolDefs: Tool[] = [
  {
    name: 'cytoscape_get_selection',
    description:
      'Get the current selection: { selectedNodes: IdType[], selectedEdges: IdType[] }.',
    inputSchema: {
      type: 'object',
      properties: {
        networkId: { type: 'string' },
      },
      required: ['networkId'],
    },
  },
  {
    name: 'cytoscape_select',
    description:
      'Replace the current selection with the specified nodes and edges (exclusive select).',
    inputSchema: {
      type: 'object',
      properties: {
        networkId: { type: 'string' },
        nodeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Node IDs to select (default: [])',
        },
        edgeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Edge IDs to select (default: [])',
        },
      },
      required: ['networkId'],
    },
  },
  {
    name: 'cytoscape_add_to_selection',
    description: 'Add elements to the current selection.',
    inputSchema: {
      type: 'object',
      properties: {
        networkId: { type: 'string' },
        nodeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Node IDs to add to the selection (default: [])',
        },
        edgeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Edge IDs to add to the selection (default: [])',
        },
      },
      required: ['networkId'],
    },
  },
  {
    name: 'cytoscape_remove_from_selection',
    description: 'Remove elements from the current selection.',
    inputSchema: {
      type: 'object',
      properties: {
        networkId: { type: 'string' },
        nodeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Node IDs to remove from the selection (default: [])',
        },
        edgeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Edge IDs to remove from the selection (default: [])',
        },
      },
      required: ['networkId'],
    },
  },
  {
    name: 'cytoscape_toggle_selection',
    description:
      'Toggle each element: selected → unselected, unselected → selected.',
    inputSchema: {
      type: 'object',
      properties: {
        networkId: { type: 'string' },
        nodeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Node IDs to toggle (default: [])',
        },
        edgeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Edge IDs to toggle (default: [])',
        },
      },
      required: ['networkId'],
    },
  },
]

// ── Tool handlers ───────────────────────────────────────────────────────────

export async function handleSelectionTool(
  page: Page,
  toolName: string,
  params: Record<string, unknown>,
): Promise<BridgeResult<unknown>> {
  switch (toolName) {
    case 'cytoscape_get_selection':
      return callApi(page, 'selection.getSelection', [params.networkId])

    case 'cytoscape_select':
      return callApi(page, 'selection.exclusiveSelect', [
        params.networkId,
        (params.nodeIds as string[]) ?? [],
        (params.edgeIds as string[]) ?? [],
      ])

    case 'cytoscape_add_to_selection':
      return callApi(page, 'selection.additiveSelect', [
        params.networkId,
        (params.nodeIds as string[]) ?? [],
        (params.edgeIds as string[]) ?? [],
      ])

    case 'cytoscape_remove_from_selection':
      return callApi(page, 'selection.additiveDeselect', [
        params.networkId,
        (params.nodeIds as string[]) ?? [],
        (params.edgeIds as string[]) ?? [],
      ])

    case 'cytoscape_toggle_selection':
      return callApi(page, 'selection.toggleSelected', [
        params.networkId,
        (params.nodeIds as string[]) ?? [],
        (params.edgeIds as string[]) ?? [],
      ])

    default:
      return {
        success: false,
        error: {
          code: 'METHOD_NOT_FOUND',
          message: `Unknown selection tool: ${toolName}`,
        },
      }
  }
}
