import {
  EditorialPage,
  EditorialMasthead,
} from "@/components/ui/editorial"

export default function SettingsPage() {
  const sections = [
    {
      href: "/settings/consultation",
      title: "Consultation",
      description: "Manage consultation prices and discount presets.",
    },
  ]

  return (
    <EditorialPage>
      <EditorialMasthead
        kicker="Settings"
        title="Configuration"
        subtitle="Manage workspace-level configuration."
      />

      <section className="mt-12 space-y-2">
        {sections.map((section) => (
          <a
            key={section.href}
            href={section.href}
            className="block p-6 border-b border-[#E5E7EB] hover:bg-[#FAFAFA] transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.4em] text-[#6B7280]">{section.title}</p>
                <p className="text-[14px] text-[#0A0A0A] mt-2 italic font-light">{section.description}</p>
              </div>
              <span className="text-base text-[#6B7280] group-hover:text-[#0A0A0A] group-hover:translate-x-0.5 transition-all">
                →
              </span>
            </div>
          </a>
        ))}
      </section>
    </EditorialPage>
  )
}
