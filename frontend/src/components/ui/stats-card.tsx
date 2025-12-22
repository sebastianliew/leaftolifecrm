"use client"

import { Card, CardContent } from "@/components/ui/card";

interface StatsCardProps {
  value: string | number;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  className?: string;
}

export function StatsCard({ value, label, sublabel, onClick, className = "" }: StatsCardProps) {
  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      aria-label={`${label}: ${value}`}
    >
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center">
          <div className="text-24px font-bold mb-2">
            {typeof value === 'number' ? value.toLocaleString('en-GB') : value}
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-medium">{label}</h3>
            {sublabel && (
              <p className="text-xs text-muted-foreground">
                {sublabel}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}