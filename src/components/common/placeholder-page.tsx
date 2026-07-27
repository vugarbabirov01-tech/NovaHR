import type { LucideIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { PageTitle } from "@/components/common/page-title"
import { EmptyState } from "@/components/common/empty-state"

interface PlaceholderPageProps {
  title: string
  description: string
  icon: LucideIcon
}

export async function PlaceholderPage({
  title,
  description,
  icon,
}: PlaceholderPageProps) {
  const t = await getTranslations("PlaceholderPage")

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={title} description={description} />
      <EmptyState
        icon={icon}
        title={t("comingSoonTitle", { module: title })}
        description={t("comingSoonDescription")}
      />
    </div>
  )
}
