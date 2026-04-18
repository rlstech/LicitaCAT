'use client'

import type { Crossing, RecConfig, Counts, ActiveTab } from '../_lib/types'
import { VerdictCard } from './verdict-card'
import { ActionPanel } from './action-panel'

interface Props {
  crossing: Crossing
  recInfo: RecConfig
  counts: Counts
  activeTab: ActiveTab
  onSetActiveTab: (tab: ActiveTab) => void
}

export function CrossingHero({ crossing, recInfo, counts, activeTab, onSetActiveTab }: Props) {
  return (
    <div className="mb-8 grid grid-cols-12 gap-5">
      <VerdictCard crossing={crossing} recInfo={recInfo} counts={counts} />
      <ActionPanel
        crossing={crossing}
        counts={counts}
        activeTab={activeTab}
        onSetActiveTab={onSetActiveTab}
      />
    </div>
  )
}
