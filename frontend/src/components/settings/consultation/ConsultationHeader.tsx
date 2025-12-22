"use client"

interface ConsultationHeaderProps {
  title?: string;
  description?: string;
}

export function ConsultationHeader({ 
  title = "Consultation Settings", 
  description = "Manage consultation pricing options" 
}: ConsultationHeaderProps) {
  return (
    <header className="shadow-sm border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
            <p className="text-gray-600">{description}</p>
          </div>
        </div>
      </div>
    </header>
  );
}