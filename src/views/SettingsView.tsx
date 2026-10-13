import { useRef } from 'react'
import { BrandLogo } from '../components/Brand'
import { Download, ExternalLink, FileSpreadsheet, Sparkles, Trash2, Upload } from 'lucide-react'
import matriUrl from '../assets/external/lovematri.png'
import { useStore, selectData } from '../store/useStore'
import { useUI, confirmDialog } from '../store/useUI'
import { todayStr } from '../lib/date'
import type { AppData } from '../types'
import { usePrefs } from '../store/usePrefs'
import { List, PageTitle, Row, SectionLabel, Segmented } from '../components/ui'
import { CloudSettingsSection } from '../components/CloudSync'
import { AppSection, NotifySection } from '../components/AppSettings'

/** 外部接続：在庫（出庫・入庫）管理アプリ LoveMatri */
const LOVEMATRI_URL = 'https://mucin7777.github.io/LoveMatri/'

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
        title: 'バックアップから復元しますか？',
        message: `細胞ライン ${parsed.lines.length} 件、播種 ${parsed.seedings.length} 件。\n今のデータは置き換わります。`,
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

  const { weekStartsOn, bandLabel, set: setPrefs } = usePrefs()

  return (
    <div>
      <PageTitle title="設定" />

      <div className="group-card grid grid-cols-4 divide-x divide-hair py-3 text-center">
        {[
          ['ライン', data.lines.length],
          ['継代', data.passages.length],
          ['播種', data.seedings.length],
          ['アッセイ', data.assays.length],
        ].map(([k, v]) => (
          <div key={k}>
            <div className="font-num text-[20px] font-semibold tabular-nums">{v}</div>
            <div className="text-[12px] text-sub">{k}</div>
          </div>
        ))}
      </div>

      <CloudSettingsSection />
      <NotifySection />
      <AppSection />

      <SectionLabel>表示</SectionLabel>
      <List>
        <div className="flex min-h-14 items-center gap-3 px-4">
          <span className="flex-1 text-[15px] font-semibold">週の始まり</span>
          <Segmented value={String(weekStartsOn) as '0' | '1'} onChange={(v) => setPrefs({ weekStartsOn: v === '1' ? 1 : 0 })} options={[{ value: '0', label: '日曜' }, { value: '1', label: '月曜' }]} />
        </div>
        <div className="flex min-h-14 items-center gap-3 px-4">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">カレンダーの帯</span>
            <span className="block text-[12px] text-sub">帯に出す文字（色はいつもライン）</span>
          </span>
          <Segmented value={bandLabel} onChange={(v) => setPrefs({ bandLabel: v })} options={[{ value: 'type', label: '種類' }, { value: 'line', label: 'ライン名' }]} />
        </div>
      </List>

      <SectionLabel>バックアップ</SectionLabel>
      <List>
        <Row onClick={exportJson} left={<Download className="size-5 text-teal-dark" />} title="バックアップを保存" sub="JSON ファイルとしてダウンロード" />
        <Row onClick={() => fileRef.current?.click()} left={<Upload className="size-5 text-teal-dark" />} title="バックアップから復元" sub="別の端末のデータを読み込む" />
        <Row onClick={exportCsv} left={<FileSpreadsheet className="size-5 text-teal-dark" />} title="記録を CSV で出力" sub="Excel で開けます" />
      </List>
      <p className="mt-2 px-1 text-[12px] leading-relaxed text-sub">
        データはこの端末のブラウザにも保存されます。クラウド同期を使わない場合、PC とスマホでは別々のデータになるため、移すときはバックアップを保存して、もう一方で復元してください。
      </p>
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

      <SectionLabel>その他</SectionLabel>
      <List>
        <a
          href={LOVEMATRI_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-mint-soft/60 active:bg-mint-soft"
        >
          <img src={matriUrl} alt="" width={44} height={44} draggable={false} className="-my-1 size-11 shrink-0 select-none" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold tracking-[0.04em] text-faint">外部接続</div>
            <div className="truncate text-[15px] font-semibold">LoveMatri を開く</div>
            <div className="truncate text-[12px] text-sub">出庫・入庫管理（別のページで開きます）</div>
          </div>
          <ExternalLink className="size-4 shrink-0 text-faint" aria-hidden="true" />
        </a>
        <Row
          onClick={() =>
            confirmDialog({
              title: 'サンプルデータを読み込みますか？',
              message: '今のデータはサンプルに置き換わります。',
              confirmLabel: '読み込む',
              onConfirm: () => {
                st.loadSample()
                toast('サンプルデータを読み込みました')
              },
            })
          }
          left={<Sparkles className="size-5 text-sub" />}
          title="サンプルデータを読み込む"
        />
        <Row
          onClick={() =>
            confirmDialog({
              title: 'すべてのデータを削除しますか？',
              message: 'この操作は取り消せません。',
              confirmLabel: '削除',
              danger: true,
              onConfirm: () => {
                st.clearAll()
                toast('すべてのデータを削除しました')
              },
            })
          }
          left={<Trash2 className="size-5 text-danger" />}
          title={<span className="text-danger">すべてのデータを削除</span>}
        />
      </List>
      <div className="mt-8 flex flex-col items-center gap-2 text-center text-[12px] text-faint">
        <BrandLogo height={22} />
        <p>細胞培養・アッセイのスケジュール管理</p>
      </div>
    </div>
  )
}
