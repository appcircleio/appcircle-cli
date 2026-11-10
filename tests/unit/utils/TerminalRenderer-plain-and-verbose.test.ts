import { describe, it, expect, vi } from 'vitest'
import { TerminalRenderer } from '../../../src/utils/TerminalRenderer'
import { ProcessedLogMessage } from '../../../src/types/build-logs'

vi.mock('chalk', () => ({
  default: {
    gray: vi.fn((t) => `[gray]${t}[/gray]`),
    blue: vi.fn((t) => `[blue]${t}[/blue]`),
    green: vi.fn((t) => `[green]${t}[/green]`),
    red: vi.fn((t) => `[red]${t}[/red]`),
    cyan: vi.fn((t) => `[cyan]${t}[/cyan]`),
    yellow: vi.fn((t) => `[yellow]${t}[/yellow]`),
    bold: Object.assign(vi.fn((t) => `[bold]${t}[/bold]`), { cyan: vi.fn((t) => `[bold-cyan]${t}[/bold-cyan]`) }),
    dim: vi.fn((t) => `[dim]${t}[/dim]`)
  }
}))

const message = (overrides: Partial<ProcessedLogMessage>): ProcessedLogMessage => ({
  id: 'm1',
  taskId: 't1',
  message: 'hello',
  messageIndex: 1,
  stepName: 'Build',
  status: 10 as any,
  timestamp: '2024-01-01T12:00:00.000Z',
  ...overrides
})

describe('TerminalRenderer plain and verbose output', () => {
  it('prints only the raw message in verbose mode, without icon or step name', () => {
    const renderer = new TerminalRenderer({ verboseMode: true })

    expect(renderer.renderMessage(message({ message: 'compiling sources' }))).toBe('compiling sources')
  })

  it('leaves markers and URLs untouched when colors are disabled', () => {
    const renderer = new TerminalRenderer({ noColor: true, verboseMode: true })
    const raw = '@@[error] see https://example.test/log ❌'

    expect(renderer.renderMessage(message({ message: raw }))).toBe(raw)
  })

  it('does not recolor an error line that already contains ANSI codes', () => {
    const renderer = new TerminalRenderer({ verboseMode: true })
    const raw = '\u001b[31m❌ step broke\u001b[0m'

    expect(renderer.renderMessage(message({ message: raw }))).toBe(raw)
  })

  it('does not recolor a warning line that already contains ANSI codes', () => {
    const renderer = new TerminalRenderer({ verboseMode: true })
    const raw = '\u001b[33mwarning: deprecated api\u001b[0m'

    expect(renderer.renderMessage(message({ message: raw }))).toBe(raw)
  })
})
