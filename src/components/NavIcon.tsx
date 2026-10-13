import calendarDefault from '../assets/icons/calendar-default.png'
import calendarActive from '../assets/icons/calendar-active.png'
import cellsDefault from '../assets/icons/cells-default.png'
import cellsActive from '../assets/icons/cells-active.png'
import seedingDefault from '../assets/icons/seeding-default.png'
import seedingActive from '../assets/icons/seeding-active.png'
import settingsDefault from '../assets/icons/settings-default.png'
import settingsActive from '../assets/icons/settings-active.png'
import { cx } from './ui'

export type NavIconName = 'calendar' | 'cells' | 'seeding' | 'settings'

const ICONS: Record<NavIconName, { default: string; active: string }> = {
  calendar: { default: calendarDefault, active: calendarActive },
  cells: { default: cellsDefault, active: cellsActive },
  seeding: { default: seedingDefault, active: seedingActive },
  settings: { default: settingsDefault, active: settingsActive },
}

/**
 * ナビのアイコン。default（グレーセージの線画）と active（ティールの輪郭＋ミントの塗り）を
 * 同じ正方形の枠に重ねて置き、不透明度だけを切り替える。
 * 画像は scripts/process-assets.py で大きさ・中心を揃えてあるので、切り替えてもガタつかない。
 * 両方を常に読み込んでおくため、切り替え時のちらつきもない。
 */
export function NavIcon({ name, active, size = 28 }: { name: NavIconName; active: boolean; size?: number }) {
  const icon = ICONS[name]
  return (
    <span aria-hidden="true" className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <img
        src={icon.default}
        alt=""
        draggable={false}
        className={cx('absolute inset-0 size-full select-none object-contain transition-opacity duration-150', active ? 'opacity-0' : 'opacity-100')}
      />
      <img
        src={icon.active}
        alt=""
        draggable={false}
        className={cx('absolute inset-0 size-full select-none object-contain transition-opacity duration-150', active ? 'opacity-100' : 'opacity-0')}
      />
    </span>
  )
}
