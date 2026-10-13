import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../../store/useStore'
import { FakeBackend, FakeServer } from './fakeBackend'
import { SyncEngine, hashData, stableStringify, useCloud, type MetaStorage } from './sync'
import type { AppData } from '../../types'

const memMeta = (): MetaStorage => {
  let m = { userId: null, rev: null, hash: null, syncedAt: null } as ReturnType<MetaStorage['load']>
  return { load: () => ({ ...m }), save: (x) => void (m = { ...x }) }
}
const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms))
const s = () => useStore.getState()
const addLine = (name: string) =>
  s().addLine({ name, origin: '', lot: '', color: '#3F7A63', passageNumber: 1, lastPassageDate: null, passageIntervalDays: 7, nextPassageDate: null, medium: '', vessel: '', notes: '' })

/** 1 台の端末（同じストアを使うので、端末を替えるときは clearAll と別の meta で表す） */
function device(server: FakeServer, meta = memMeta()) {
  const backend = new FakeBackend(server)
  const engine = new SyncEngine(backend, { debounceMs: 5, pollMs: 0, browserEvents: false, meta })
  return { backend, engine, meta }
}

let server: FakeServer
beforeEach(() => {
  server = new FakeServer()
  s().clearAll()
  useCloud.setState({ status: 'loading', user: null, conflict: null, error: null, errorKind: null, lastSyncedAt: null })
})

describe('stableStringify / hashData', () => {
  it('キーの順序が違っても同じハッシュになる', () => {
    const a = { version: 1, lines: [{ id: 'x', name: 'A', color: '#000' }], passages: [], seedings: [], assays: [], tasks: [] }
    const b = { tasks: [], assays: [], seedings: [], passages: [], lines: [{ color: '#000', name: 'A', id: 'x' }], version: 1 }
    expect(stableStringify(a)).toBe(stableStringify(b))
    expect(hashData(a as unknown as AppData)).toBe(hashData(b as unknown as AppData))
  })
})

describe('SyncEngine', () => {
  it('新規登録すると手元のデータをクラウドへ送る', async () => {
    addLine('Caco-2')
    const d = device(server)
    await d.engine.start()
    expect(useCloud.getState().status).toBe('signedOut')
    await d.engine.signUp('me@example.com', 'secret1')
    expect(useCloud.getState().status).toBe('synced')
    const row = server.rows.get('user-1')!
    expect(row.data.lines.map((l) => l.name)).toEqual(['Caco-2'])
    d.engine.stop()
  })

  it('手元の変更は少し待ってから送り、版番号が進む', async () => {
    const d = device(server)
    await d.engine.start()
    await d.engine.signUp('me@example.com', 'secret1')
    addLine('HeLa')
    expect(useCloud.getState().status).toBe('pending')
    await wait()
    expect(useCloud.getState().status).toBe('synced')
    expect(server.rows.get('user-1')!.data.lines).toHaveLength(1)
    const rev1 = server.rows.get('user-1')!.rev
    addLine('Vero')
    await wait()
    expect(server.rows.get('user-1')!.rev).toBe(rev1 + 1)
    d.engine.stop()
  })

  it('別の端末で初めてログインすると、クラウドのデータを取り込む（空の端末）', async () => {
    const a = device(server)
    await a.engine.start()
    await a.engine.signUp('me@example.com', 'secret1')
    addLine('Lot1')
    addLine('Lot2')
    await wait()
    a.engine.stop()

    // 2 台目：手元は空
    s().clearAll()
    const b = device(server)
    await b.engine.start()
    await b.engine.signIn('me@example.com', 'secret1')
    expect(useCloud.getState().status).toBe('synced')
    expect(s().lines.map((l) => l.name).sort()).toEqual(['Lot1', 'Lot2'])
    b.engine.stop()
  })

  it('取り込んだ直後に送り返さない（無限ループしない）', async () => {
    const a = device(server)
    await a.engine.start()
    await a.engine.signUp('me@example.com', 'secret1')
    addLine('Lot1')
    await wait()
    const savesBefore = a.backend.saves
    server.writeAsOtherDevice('user-1', { ...server.rows.get('user-1')!.data, lines: [] })
    await wait()
    expect(s().lines).toHaveLength(0)
    await wait()
    expect(a.backend.saves).toBe(savesBefore)
    a.engine.stop()
  })

  it('手元が未変更なら、他の端末の更新をそのまま取り込む', async () => {
    const a = device(server)
    await a.engine.start()
    await a.engine.signUp('me@example.com', 'secret1')
    addLine('Lot1')
    await wait()
    const remote = server.rows.get('user-1')!.data
    server.writeAsOtherDevice('user-1', { ...remote, lines: [...remote.lines, { ...remote.lines[0], id: 'other', name: 'from phone' }] })
    await wait()
    expect(s().lines.map((l) => l.name)).toContain('from phone')
    expect(useCloud.getState().status).toBe('synced')
    a.engine.stop()
  })

  it('両方で変更されていたら黙って上書きせず、競合として選ばせる', async () => {
    const a = device(server)
    await a.engine.start()
    await a.engine.signUp('me@example.com', 'secret1')
    addLine('Lot1')
    await wait()
    // オフライン中に手元を変更し、その間に別の端末がクラウドを更新
    server.offline = true
    addLine('local edit')
    await wait()
    expect(useCloud.getState().status).toBe('offline')
    const remote = server.rows.get('user-1')!.data
    server.rows.set('user-1', { data: { ...remote, lines: [...remote.lines, { ...remote.lines[0], id: 'p', name: 'phone edit' }] }, rev: 99, updatedAt: server.now() })
    server.offline = false
    await a.engine.syncNow()
    expect(useCloud.getState().status).toBe('conflict')
    expect(server.rows.get('user-1')!.data.lines.map((l) => l.name)).toContain('phone edit') // 上書きされていない

    // 「クラウドの内容を使う」
    await a.engine.resolveConflict('remote')
    expect(useCloud.getState().status).toBe('synced')
    expect(s().lines.map((l) => l.name).sort()).toEqual(['Lot1', 'phone edit'])
    a.engine.stop()
  })

  it('競合で「この端末の内容を使う」を選ぶとクラウドを上書きする', async () => {
    const a = device(server)
    await a.engine.start()
    await a.engine.signUp('me@example.com', 'secret1')
    addLine('Lot1')
    await wait()
    server.offline = true
    addLine('local edit')
    await wait()
    server.rows.set('user-1', { data: { ...server.rows.get('user-1')!.data, lines: [] }, rev: 50, updatedAt: server.now() })
    server.offline = false
    await a.engine.syncNow()
    expect(useCloud.getState().status).toBe('conflict')
    await a.engine.resolveConflict('local')
    expect(useCloud.getState().status).toBe('synced')
    expect(server.rows.get('user-1')!.data.lines.map((l) => l.name).sort()).toEqual(['Lot1', 'local edit'])
    a.engine.stop()
  })

  it('オフライン中の変更は、つながったときに送る', async () => {
    const a = device(server)
    await a.engine.start()
    await a.engine.signUp('me@example.com', 'secret1')
    server.offline = true
    addLine('offline line')
    await wait()
    expect(useCloud.getState().status).toBe('offline')
    expect(useCloud.getState().error).toBe('ネットワークに接続できません')
    server.offline = false
    await a.engine.syncNow()
    expect(useCloud.getState().status).toBe('synced')
    expect(server.rows.get('user-1')!.data.lines.map((l) => l.name)).toEqual(['offline line'])
    a.engine.stop()
  })

  it('パスワードが違うと日本語のエラーになる', async () => {
    const a = device(server)
    await a.engine.start()
    await a.engine.signUp('me@example.com', 'secret1')
    await a.engine.signOut()
    expect(useCloud.getState().status).toBe('signedOut')
    await expect(a.engine.signIn('me@example.com', 'wrong')).rejects.toThrow('メールアドレスかパスワードが違います')
    a.engine.stop()
  })

  it('ログアウトしても手元のデータは残る', async () => {
    const a = device(server)
    await a.engine.start()
    await a.engine.signUp('me@example.com', 'secret1')
    addLine('keep me')
    await wait()
    await a.engine.signOut()
    expect(s().lines.map((l) => l.name)).toEqual(['keep me'])
    a.engine.stop()
  })
})
