import { CATEGORY_META } from '@/lib/utils'
import type { Category } from '@/lib/types'

export default function CategoryChip({ category, small }: { category: Category; small?: boolean }) {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.other
  return (
    <span className={`inline-flex items-center rounded-full font-medium
      ${meta.bg} ${meta.color}
      ${small ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'}`}>
      {meta.label}
    </span>
  )
}
