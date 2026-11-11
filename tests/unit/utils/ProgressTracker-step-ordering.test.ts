import { describe, it, expect, vi, afterEach } from 'vitest'
import { ProgressTracker } from '../../../src/utils/ProgressTracker'
import { ProcessedLogMessage } from '../../../src/types/build-logs'

const message = (stepName: string): ProcessedLogMessage => ({
  id: stepName,
  taskId: 't1',
  message: 'line',
  messageIndex: 1,
  stepName,
  status: 1 as any,
  timestamp: '1970-01-01T00:00:00.000Z'
})

describe('ProgressTracker step ordering', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('orders steps by start time when one step started at the epoch', () => {
    vi.useFakeTimers()
    const tracker = new ProgressTracker(false)

    vi.setSystemTime(5000)
    tracker.updateProgress(message('Later step'))
    vi.setSystemTime(0)
    tracker.updateProgress(message('Epoch step'))
    vi.setSystemTime(3000)
    tracker.updateProgress(message('Middle step'))

    expect(tracker.getAllSteps().map((s) => [s.name, s.startTime?.getTime()])).toEqual([
      ['Epoch step', 0],
      ['Middle step', 3000],
      ['Later step', 5000]
    ])
  })
})
