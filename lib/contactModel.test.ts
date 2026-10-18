import { describe, expect, it } from 'vitest'
import {
  cleanText,
  inviteUrl,
  newContactRecord,
  parseBotCommand,
  publicContact,
  stoppedMessage,
  welcomeMessage,
} from './contactModel.js'

describe('cleanText', () => {
  it('trims and collapses whitespace', () => {
    expect(cleanText('  Ana   María \n', 40)).toBe('Ana María')
  })

  it('rejects empty, too long and non-string values', () => {
    expect(cleanText('   ', 40)).toBeNull()
    expect(cleanText('x'.repeat(41), 40)).toBeNull()
    expect(cleanText(42, 40)).toBeNull()
  })
})

describe('parseBotCommand', () => {
  it('reads the invite code from /start', () => {
    expect(parseBotCommand('/start abcDEF12_-x')).toEqual({ command: 'start', code: 'abcDEF12_-x' })
    expect(parseBotCommand('/start@VSegurabot abcDEF12')).toEqual({ command: 'start', code: 'abcDEF12' })
  })

  it('ignores a missing or malformed code', () => {
    expect(parseBotCommand('/start')).toEqual({ command: 'start', code: null })
    expect(parseBotCommand('/start <script>')).toEqual({ command: 'start', code: null })
  })

  it('recognizes /stop and anything else', () => {
    expect(parseBotCommand('/STOP')).toEqual({ command: 'stop' })
    expect(parseBotCommand('hola')).toEqual({ command: 'other' })
    expect(parseBotCommand(undefined)).toEqual({ command: 'other' })
  })
})

describe('contacts', () => {
  it('never exposes the chat id or invite code', () => {
    const contact = { ...newContactRecord('id', 'Ana', 'secret-code', 1), chatId: '123' }
    const view = publicContact(contact)
    expect(view).not.toHaveProperty('chatId')
    expect(view).not.toHaveProperty('inviteCode')
    expect(view).toMatchObject({ id: 'id', name: 'Ana', status: 'pending' })
  })

  it('builds the deep link', () => {
    expect(inviteUrl('VSegurabot', 'abc12345')).toBe('https://t.me/VSegurabot?start=abc12345')
  })
})

describe('bot replies', () => {
  it('escapes names in the welcome message', () => {
    const text = welcomeMessage('<b>', 'Ana & Co')
    expect(text).toContain('&lt;b&gt;')
    expect(text).toContain('<b>Ana &amp; Co</b>')
  })

  it('falls back when the owner has no name yet', () => {
    expect(welcomeMessage('', '')).toContain('la persona que te invitó')
  })

  it('tells apart unsubscribing from nothing to stop', () => {
    expect(stoppedMessage(2)).toContain('ya no recibirás')
    expect(stoppedMessage(0)).toContain('No tienes')
  })
})
