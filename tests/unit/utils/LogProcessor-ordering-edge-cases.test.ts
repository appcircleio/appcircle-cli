import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LogProcessor } from '../../../src/utils/LogProcessor'
import { ServerOutputData } from '../../../src/types/build-logs'

function msg(overrides: Partial<ServerOutputData>): ServerOutputData {
  return {
    id: 'id',
    taskId: 'task-1',
    message: 'line',
    workflowName: 'wf',
    workflowStatus: 1 as any,
    progressTime: '2026-01-01T00:00:00Z',
    ...overrides
  }
}

describe('LogProcessor ordering edge cases', () => {
  let emitted: any[]
  let processor: LogProcessor

  beforeEach(() => {
    emitted = []
    processor = new LogProcessor((m) => emitted.push(m))
  })

  it('drops empty and whitespace-only messages without buffering them', () => {
    processor.processMessage(msg({ id: 'a', message: '' }))
    processor.processMessage(msg({ id: 'b', message: '   ' }))

    expect(emitted).toEqual([])
    expect(processor.getProcessingStats()).toEqual({
      buffered: 0,
      processed: false,
      waitingForEmit: 0,
      nextExpectedIndex: 1
    })
  })

  it('starts logs on a section marker and emits buffered messages without an index as index 0', () => {
    processor.processMessage(msg({ id: 'buffered', message: 'plain line' }))
    expect(processor.getProcessingStats().buffered).toBe(1)

    processor.processMessage(msg({ id: 'marker', message: '@@[section:start] Build' }))

    expect(emitted.map((m) => [m.id, m.messageIndex, m.stepName])).toEqual([
      ['buffered', 0, 'all'],
      ['marker', 0, 'all']
    ])
    expect(processor.getProcessingStats().processed).toBe(true)
  })

  // Current behaviour, not the intended order: insertInOrder appends a message whose index is lower than
  // every waiting message to the end instead of the front, so the flush emits 3 before 2.
  it('keeps a lower-index message behind higher buffered ones until everything is flushed', () => {
    processor.forceStartLogs()
    processor.processMessage(msg({ id: 'three', message: 'third', messageIndex: 3 }))
    processor.processMessage(msg({ id: 'two', message: 'second', messageIndex: 2 }))

    expect(emitted).toEqual([])
    expect(processor.getProcessingStats().waitingForEmit).toBe(2)

    processor.flushAllMessages()

    expect(emitted.map((m) => m.id)).toEqual(['three', 'two'])
    expect(processor.getProcessingStats().waitingForEmit).toBe(0)
  })

  it('flushAllMessages does nothing when no message is waiting', () => {
    processor.flushAllMessages()

    expect(emitted).toEqual([])
  })

  // processAndEmit is a private method with no caller in src (dead code); it is called directly here.
  it('processAndEmit emits a message immediately and advances the expected index', () => {
    ;(processor as any).processAndEmit(msg({ id: 'p1', message: 'step', messageIndex: 5, stepName: 'step' }))
    ;(processor as any).processAndEmit(msg({ id: 'p2', message: 'no index' }))

    expect(emitted).toEqual([
      expect.objectContaining({ id: 'p1', messageIndex: 5, stepName: 'step', isStepEcho: true }),
      expect.objectContaining({ id: 'p2', messageIndex: 0, stepName: 'all', isStepEcho: false })
    ])
    expect(processor.getProcessingStats().nextExpectedIndex).toBe(6)
  })
})
