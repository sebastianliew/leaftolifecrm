export default function SettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      <div className="grid gap-4">
        <a href="/settings/consultation" className="p-4 border rounded-lg hover:bg-gray-50">
          <h2 className="text-xl font-semibold">Consultation Settings</h2>
          <p className="text-gray-600">Manage consultation prices and discount presets</p>
        </a>
      </div>
    </div>
  );
}