import type { AppData, Assay, CellLine, PassageRecord, Seeding, Task } from '../types'
import { addDaysStr, todayStr } from './date'
import { uid } from './id'
import { LINE_COLORS } from './constants'

/** 今日を基準にしたデモ用データ */
export function createSampleData(): AppData {
  const t = todayStr()
  const d = (n: number) => addDaysStr(t, n)
  const now = new Date().toISOString()

  const mk = (p: Partial<CellLine> & Pick<CellLine, 'name' | 'origin' | 'lot' | 'color'>): CellLine => ({
    id: uid(),
    passageNumber: 0,
    lastPassageDate: null,
    passageIntervalDays: 7,
    nextPassageDate: null,
    medium: '',
    vessel: '',
    notes: '',
    archived: false,
    createdAt: now,
    ...p,
  })

  const ileum1 = mk({ name: 'ヒト回腸 Lot1', shortName: '回腸1', origin: 'ヒト回腸オルガノイド', lot: 'Lot1', color: LINE_COLORS[0], passageNumber: 12, lastPassageDate: d(-7), nextPassageDate: d(0), medium: 'IntestiCult', vessel: 'Matrigel ドーム (24well)' })
  const ileum2 = mk({ name: 'ヒト回腸 Lot2', shortName: '回腸2', origin: 'ヒト回腸オルガノイド', lot: 'Lot2', color: LINE_COLORS[1], passageNumber: 8, lastPassageDate: d(-5), nextPassageDate: d(2), medium: 'IntestiCult', vessel: 'Matrigel ドーム (24well)' })
  const mouse3 = mk({ name: 'マウス Lot3', shortName: 'マウス3', origin: 'マウス小腸オルガノイド', lot: 'Lot3', color: LINE_COLORS[2], passageNumber: 21, lastPassageDate: d(-6), nextPassageDate: d(1), passageIntervalDays: 6, medium: 'ENR', vessel: 'Matrigel ドーム (48well)' })
  const caco2 = mk({ name: 'Caco-2', shortName: 'Caco2', origin: 'ヒト結腸癌由来株', lot: 'ATCC HTB-37', color: LINE_COLORS[3], passageNumber: 34, lastPassageDate: d(-4), nextPassageDate: d(-1), passageIntervalDays: 3, medium: 'DMEM + 10% FBS', vessel: 'T75 フラスコ' })
  const lines = [ileum1, ileum2, mouse3, caco2]

  const passages: PassageRecord[] = [
    { id: uid(), lineId: ileum1.id, date: d(-14), passageNumber: 11, splitRatio: '1:3', notes: '' },
    { id: uid(), lineId: ileum1.id, date: d(-7), passageNumber: 12, splitRatio: '1:4', notes: '' },
    { id: uid(), lineId: ileum2.id, date: d(-12), passageNumber: 7, splitRatio: '1:3', notes: '' },
    { id: uid(), lineId: ileum2.id, date: d(-5), passageNumber: 8, splitRatio: '1:3', notes: '増殖やや遅め' },
    { id: uid(), lineId: mouse3.id, date: d(-6), passageNumber: 21, splitRatio: '1:5', notes: '' },
    { id: uid(), lineId: caco2.id, date: d(-7), passageNumber: 33, splitRatio: '1:8', notes: '' },
    { id: uid(), lineId: caco2.id, date: d(-4), passageNumber: 34, splitRatio: '1:8', notes: '' },
  ]

  const sd = (p: Omit<Seeding, 'id' | 'createdAt'>): Seeding => ({ id: uid(), createdAt: now, ...p })
  const s1 = sd({ lineId: ileum1.id, date: d(-4), plateType: '96ウェルプレート', passageNumber: 12, density: '5,000 cells/well', wells: '60 wells', purpose: '薬剤 A 毒性評価', notes: '', status: 'assay_scheduled' })
  const s2 = sd({ lineId: caco2.id, date: d(-18), plateType: 'Transwell (24)', passageNumber: 30, density: '1×10^5 cells/cm²', wells: '12 inserts', purpose: 'バリア機能評価 (21日分化)', notes: '培地交換 2-3日おき', status: 'assay_scheduled' })
  const s3 = sd({ lineId: ileum2.id, date: d(-1), plateType: '24ウェルプレート', passageNumber: 8, density: '', wells: '24 wells', purpose: '分化誘導 → qPCR', notes: '', status: 'culturing' })
  const s4 = sd({ lineId: mouse3.id, date: d(-20), plateType: '48ウェルプレート', passageNumber: 18, density: '', wells: '', purpose: '免疫染色', notes: '', status: 'completed' })
  const s5 = sd({ lineId: ileum1.id, date: d(7), plateType: '96ウェルプレート', passageNumber: 13, density: '5,000 cells/well', wells: '60 wells', purpose: '薬剤 B 評価（予定）', notes: '', status: 'culturing' })
  const seedings = [s1, s2, s3, s4, s5]

  const as = (p: Omit<Assay, 'id' | 'doneAt' | 'result'> & Partial<Pick<Assay, 'result'>>): Assay => ({
    id: uid(),
    doneAt: p.done ? now : null,
    result: '',
    ...p,
  })
  const assays: Assay[] = [
    as({ seedingId: s1.id, date: d(0), time: '10:00', name: '薬剤 A 添加', notes: '0, 1, 10, 100 µM', done: false }),
    as({ seedingId: s1.id, date: d(2), time: '', name: 'WST-8 アッセイ', notes: '48h 後', done: false }),
    as({ seedingId: s2.id, date: d(3), time: '13:00', name: 'TEER 測定', notes: '', done: false }),
    as({ seedingId: s2.id, date: d(4), time: '', name: '透過性アッセイ (FITC-dextran)', notes: '', done: false }),
    as({ seedingId: s4.id, date: d(-13), time: '', name: '固定・免疫染色', notes: '', done: true, result: 'Lgr5, Villin 陽性を確認' }),
    as({ seedingId: s3.id, date: d(8), time: '', name: 'qPCR 用回収', notes: '', done: false }),
  ]

  const tasks: Task[] = [
    { id: uid(), date: d(0), kind: 'medium', title: 'Transwell 培地交換', lineId: caco2.id, seedingId: s2.id, notes: '', done: false },
    { id: uid(), date: d(-2), kind: 'medium', title: 'Transwell 培地交換', lineId: caco2.id, seedingId: s2.id, notes: '', done: true },
    { id: uid(), date: d(1), kind: 'medium', title: 'オルガノイド培地交換', lineId: ileum2.id, seedingId: null, notes: '', done: false },
    { id: uid(), date: d(3), kind: 'medium', title: 'Transwell 培地交換', lineId: caco2.id, seedingId: s2.id, notes: '', done: false },
    { id: uid(), date: d(5), kind: 'other', title: 'Matrigel 発注', lineId: null, seedingId: null, notes: '', done: false },
    { id: uid(), date: d(6), kind: 'medium', title: 'オルガノイド培地交換', lineId: ileum2.id, seedingId: s3.id, notes: '', done: false },
    { id: uid(), date: d(10), kind: 'medium', title: 'オルガノイド培地交換', lineId: ileum2.id, seedingId: s3.id, notes: '', done: false },
  ]

  return { version: 1, lines, passages, seedings, assays, tasks }
}
