import { useRef } from 'react'
import { Download, Database, Sparkles, Trash2, Upload } from 'lucide-react'
import { useStore, selectData } from '../store/useStore'
import { useUI, confirmDialog } from '../store/useUI'
import { todayStr } from '../lib/date'
import type { AppData } from '../types'
import { PageHeader } from '../components/ui'

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const toCsv = (rows: unknown[][]) => '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n')

export function SettingsView() {
  const st = useStore()
  const toast = useUI((s) => s.toast)
  const fileRef = useRef<HTMLInputElement>(null)
  const data = selectData(st)

  const exportJson = () => {
    download(`cellendar-backup-${todayStr()}.json`, JSON.stringify(data, null, 2), 'application/json')
    toast('バックアップをダウンロードしました')
  }

  const exportCsv = () => {
    const lineById = new Map(data.lines.map((l) => [l.id, l]))
    const seedingById = new Map(data.seedings.map((s) => [s.id, s]))
    const rows: unknown[][] = [['種類', '日付', '細胞ライン', '内容', 'P数', 'プレート', '状態', 'メモ・結果']]
    for (const p of data.passages) rows.push(['継代', p.date, lineById.get(p.lineId)?.name, p.splitRatio, p.passageNumber, '', '完了', p.notes])
    for (const s of data.seedings) rows.push(['播種', s.date, lineById.get(s.lineId)?.name, s.purpose, s.passageNumber, s.plateType, s.status, s.notes])
    for (const a of data.assays) {
      const s = seedingById.get(a.seedingId)
      rows.push(['アッセイ', a.date, s && lineById.get(s.lineId)?.name, a.name, '', s?.plateType, a.done ? '完了' : '予定', [a.notes, a.result].filter(Boolean).join(' / ')])
    }
    rows.sort((a, b) => (a === rows[0] ? -1 : b === rows[0] ? 1 : String(a[1]).localeCompare(String(b[1]))))
    download(`cellendar-records-${todayStr()}.csv`, toCsv(rows), 'text/csv')
  }

  const onImport = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<AppData>
      if (!Array.isArray(parsed.lines) || !Array.isArray(parsed.seedings)) throw new Error('invalid')
      confirmDialog({
        title: 'バックアップを読み込む',
        message: `細胞ライン ${parsed.lines.length} 件、播種記録 ${parsed.seedings.length} 件を読み込みます。\n現在のデータはすべて置き換えられます。`,
        confirmLabel: '読み込む',
        onConfirm: () => {
          st.replaceAll({
            version: 1,
            lines: parsed.lines ?? [],
            passages: parsed.passages ?? [],
            seedings: parsed.seedings ?? [],
            assays: parsed.assays ?? [],
            tasks: parsed.tasks ?? [],
          })
          toast('データを読み込みました')
        },
      })
    } catch {
      toast('ファイルを読み込めませんでした（Cellendar のバックアップ JSON を選択してください）')
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="設定・データ" subtitle="データはこのブラウザ内（localStorage）に自動保存されます" />

      <div className="card mb-5 grid grid-cols-2 gap-px overflow-hidden bg-slate-100 sm:grid-cols-5">
        {[
          ['細胞ライン', data.lines.length],
          ['継代記録', data.passages.length],
          ['播種記録', data.seedings.length],
          ['アッセイ', data.assays.length],
          ['その他予定', data.tasks.length],
        ].map(([k, v]) => (
          <div key={k} className="bg-white px-4 py-3">
            <div className="text-xs text-slate-400">{k}</div>
            <div className="text-xl font-bold text-slate-800">{v}</div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <Card icon={<Database className="size-5" />} title="バックアップ" desc="ブラウザのデータ消去や PC の変更に備えて、定期的にバックアップを保存してください。JSON は別の PC・ブラウザで読み込めます。">
          <button className="btn-primary" onClick={exportJson}>
            <Download className="size-4" />
            バックアップ (JSON)
          </button>
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            バックアップを読み込む
          </button>
          <button className="btn-secondary" onClick={exportCsv}>
            <Download className="size-4" />
            記録を CSV 出力
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onImport(f)
              e.target.value = ''
            }}
          />
        </Card>

        <Card icon={<Sparkles className="size-5" />} title="サンプルデータ" desc="今日を基準にしたデモデータ（ヒト回腸 Lot1/Lot2、マウス Lot3、Caco-2）を読み込みます。現在のデータは置き換えられます。">
          <button
            className="btn-secondary"
            onClick={() =>
              confirmDialog({
                title: 'サンプルデータを読み込む',
                message: '現在のデータはすべてサンプルデータに置き換えられます。',
                confirmLabel: '読み込む',
                onConfirm: () => {
                  st.loadSample()
                  toast('サンプルデータを読み込みました')
                },
              })
            }
          >
            サンプルデータを読み込む
          </button>
        </Card>

        <Card icon={<Trash2 className="size-5 text-rose-600" />} title="すべてのデータを削除" desc="このブラウザに保存されたすべての記録を削除します。必要に応じて先にバックアップしてください。">
          <button
            className="btn-secondary text-rose-600 hover:bg-rose-50"
            onClick={() =>
              confirmDialog({
                title: 'すべてのデータを削除',
                message: 'すべての細胞ライン・継代・播種・アッセイの記録を削除します。この操作は取り消せません。',
                confirmLabel: '削除する',
                danger: true,
                onConfirm: () => {
                  st.clearAll()
                  toast('すべてのデータを削除しました')
                },
              })
            }
          >
            すべて削除
          </button>
        </Card>
      </div>
    </div>
  )
}

function Card({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col gap-4 p-5 sm:flex-row">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">{icon}</div>
      <div className="min-w-0 flex-1">
        <h2 className="font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{desc}</p>
        <div className="mt-3 flex flex-wrap gap-2">{children}</div>
      </div>
    </section>
  )
}
